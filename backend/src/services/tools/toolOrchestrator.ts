import { recognizeImage } from './imageRecognition';
import { queryKnowledgeBase, formatKnowledgeBase } from './knowledgeBase';
import { searchWeb, formatWebSearch } from './webSearch';
import { ToolContext, ToolResult, TIMEOUT_CONFIG, ImageRecognitionConfig } from './types';
import { createToolCallEvent } from '../../agent/events/chat-event-types';
import { v4 as uuidv4 } from 'uuid';

/**
 * 带超时的 Promise 包装器
 * @param promise 要执行的 Promise
 * @param timeoutMs 超时时间（毫秒）
 * @param errorMessage 超时错误消息
 * @returns Promise，超时则 reject
 */
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    ),
  ]);
}

/**
 * 判断意图是否需要图片识别
 * hospital_recommend 不需要图片识别
 */
function needsImageRecognition(intent: string): boolean {
  return intent !== 'hospital_recommend';
}

/**
 * 工具编排器 - 统一管理所有工具调用
 * @param context 工具上下文
 * @returns 工具执行结果
 */
export async function orchestrateTools(context: ToolContext): Promise<ToolResult> {
  const {
    query,
    intent,
    imageUrls,
    conversationId,
    messageId,
    eventEmitter,
  } = context;

  const toolsUsed: string[] = [];
  const result: ToolResult = {
    success: false,
    enhancedQuery: query,
    toolsUsed,
  };

  // 1. 图片识别（如有图片且意图需要）
  let imageDescription: string | undefined;
  if (imageUrls && imageUrls.length > 0 && needsImageRecognition(intent)) {
    const toolId = `tool_${uuidv4()}`;
    const toolName = 'image_recognition';

    try {
      // 发送工具调用开始事件
      eventEmitter.emit(
        'tool:call',
        createToolCallEvent(
          conversationId,
          toolId,
          toolName,
          messageId,
          'running',
          {
            input: {
              imageUrl: imageUrls[0],
              intent,
            },
          }
        )
      );

      const startTime = Date.now();
      const imageResult = await withTimeout(
        recognizeImage(imageUrls[0], { intent } as ImageRecognitionConfig),
        TIMEOUT_CONFIG.imageRecognition,
        'Image recognition timeout'
      );
      const duration = Date.now() - startTime;

      imageDescription = imageResult.description;
      toolsUsed.push('image_recognition');

      // 增强查询：将图片描述添加到查询中
      result.enhancedQuery = `${query}\n\n图片描述：${imageDescription}`;

      // 发送工具调用完成事件
      eventEmitter.emit(
        'tool:call',
        createToolCallEvent(
          conversationId,
          toolId,
          toolName,
          messageId,
          'completed',
          {
            output: {
              description: imageDescription,
            },
            duration,
          }
        )
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.warn('[Tool] Image recognition failed:', errorMessage);

      // 发送工具调用失败事件
      eventEmitter.emit(
        'tool:call',
        createToolCallEvent(
          conversationId,
          toolId,
          toolName,
          messageId,
          'failed',
          {
            error: errorMessage,
          }
        )
      );

      // 图片识别失败不影响后续流程
      toolsUsed.push('image_recognition');
    }
  }

  // 2. 知识库查询
  const knowledgeToolId = `tool_${uuidv4()}`;
  const knowledgeToolName = 'knowledge_base';

  try {
    // 发送工具调用开始事件
    eventEmitter.emit(
      'tool:call',
      createToolCallEvent(
        conversationId,
        knowledgeToolId,
        knowledgeToolName,
        messageId,
        'running',
        {
          input: {
            query: result.enhancedQuery,
          },
        }
      )
    );

    const startTime = Date.now();
    const knowledgeResult = await withTimeout(
      queryKnowledgeBase(result.enhancedQuery),
      TIMEOUT_CONFIG.knowledgeBase,
      'Knowledge base query timeout'
    );
    const duration = Date.now() - startTime;

    toolsUsed.push('knowledge_base');

    if (knowledgeResult.hasResults) {
      // 知识库有结果，直接返回
      const formattedKnowledge = formatKnowledgeBase(knowledgeResult);
      result.success = true;
      // 确保 data 对象被正确初始化
      result.data = {};
      if (imageDescription) {
        result.data.imageDescription = imageDescription;
      }
      result.data.knowledgeBase = formattedKnowledge;

      // 发送工具调用完成事件
      eventEmitter.emit(
        'tool:call',
        createToolCallEvent(
          conversationId,
          knowledgeToolId,
          knowledgeToolName,
          messageId,
          'completed',
          {
            output: {
              hasResults: true,
              documentCount: knowledgeResult.documents.length,
            },
            duration,
          }
        )
      );

      return result;
    } else {
      // 知识库无结果，发送完成事件（但 hasResults: false）
      eventEmitter.emit(
        'tool:call',
        createToolCallEvent(
          conversationId,
          knowledgeToolId,
          knowledgeToolName,
          messageId,
          'completed',
          {
            output: {
              hasResults: false,
            },
            duration,
          }
        )
      );
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.warn('[Tool] Knowledge base query failed:', errorMessage);

    // 发送工具调用失败事件
    eventEmitter.emit(
      'tool:call',
      createToolCallEvent(
        conversationId,
        knowledgeToolId,
        knowledgeToolName,
        messageId,
        'failed',
        {
          error: errorMessage,
        }
      )
    );

    toolsUsed.push('knowledge_base');
    // 知识库失败，继续尝试网络搜索
  }

  // 3. 网络搜索（降级）
  const webSearchToolId = `tool_${uuidv4()}`;
  const webSearchToolName = 'web_search';

  try {
    // 发送工具调用开始事件
    eventEmitter.emit(
      'tool:call',
      createToolCallEvent(
        conversationId,
        webSearchToolId,
        webSearchToolName,
        messageId,
        'running',
        {
          input: {
            query: result.enhancedQuery,
          },
        }
      )
    );

    const startTime = Date.now();
    const webSearchResult = await withTimeout(
      searchWeb(result.enhancedQuery),
      TIMEOUT_CONFIG.webSearch,
      'Web search timeout'
    );
    const duration = Date.now() - startTime;

    toolsUsed.push('web_search');

    if (webSearchResult.hasResults) {
      const formattedWebSearch = formatWebSearch(webSearchResult);
      result.success = true;
      // 确保 data 对象被正确初始化
      result.data = {};
      if (imageDescription) {
        result.data.imageDescription = imageDescription;
      }
      result.data.webSearch = formattedWebSearch;

      // 发送工具调用完成事件
      eventEmitter.emit(
        'tool:call',
        createToolCallEvent(
          conversationId,
          webSearchToolId,
          webSearchToolName,
          messageId,
          'completed',
          {
            output: {
              hasResults: true,
              sourceCount: webSearchResult.sources.length,
            },
            duration,
          }
        )
      );

      return result;
    } else {
      // 网络搜索无结果
      eventEmitter.emit(
        'tool:call',
        createToolCallEvent(
          conversationId,
          webSearchToolId,
          webSearchToolName,
          messageId,
          'completed',
          {
            output: {
              hasResults: false,
            },
            duration,
          }
        )
      );
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.warn('[Tool] Web search failed:', errorMessage);

    // 发送工具调用失败事件
    eventEmitter.emit(
      'tool:call',
      createToolCallEvent(
        conversationId,
        webSearchToolId,
        webSearchToolName,
        messageId,
        'failed',
        {
          error: errorMessage,
        }
      )
    );

    toolsUsed.push('web_search');
    // 所有工具都失败，返回失败状态
  }

  // 所有工具都失败或无结果
  return result;
}
