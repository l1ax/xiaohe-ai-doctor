import type { AgentStateType } from '../state';
import type { UserIntent, Message } from '../types';
import { queryKnowledgeBase } from '../tools/queryKnowledgeBase';
import { searchWeb } from '../tools/searchWeb';
import { createDeepSeekLLM, streamLLMResponse } from '../../utils/llm';
import { buildQuickResponsePrompt } from '../prompts/quickResponsePrompt';
import { createConversationEndEvent } from '../events/chat-event-types';

/**
 * Quick Response 节点 - 快速响应通道
 *
 * 适用场景：症状咨询、用药咨询、健康建议等简单意图
 *
 * 流程：
 * 1. 根据意图选择工具策略
 * 2. 调用相应工具获取信息
 * 3. 单次 LLM 调用生成最终回复
 * 4. 流式发送给用户
 */

type ToolStrategy = 'kb_only' | 'web_only' | 'kb_first' | 'web_first' | 'llm_only';

/**
 * 根据意图选择工具策略
 */
function getToolStrategy(intent: UserIntent | null): ToolStrategy {
  switch (intent) {
    case 'symptom_consult':
    case 'medicine_info':
    case 'health_advice':
      return 'kb_first';  // 医疗相关优先知识库
    case 'general_qa':
      return 'llm_only';  // 通用问答直接用 LLM
    case 'hospital_recommend':
      return 'web_only';  // 医院推荐只用搜索
    default:
      return 'kb_first';  // 默认知识库优先
  }
}

/**
 * 格式化对话历史
 */
function formatConversationHistory(messages: Message[]): string {
  if (messages.length <= 1) return '';

  // 取最近 5 轮对话（不包括当前消息）
  const history = messages.slice(-11, -1);  // 最多 5 轮 = 10 条消息
  if (history.length === 0) return '';

  const formatted = history
    .map(m => `${m.role === 'user' ? '用户' : '助手'}: ${m.content}`)
    .join('\n');

  return `# 对话历史\n\n${formatted}\n\n`;
}

/**
 * 构建直接响应 Prompt（不依赖工具结果）
 */
function buildDirectResponsePrompt(
  messages: Message[],
  userQuery: string,
  intent?: UserIntent | null,
  imageDescription?: string
): string {
  const history = formatConversationHistory(messages);
  const imageContext = imageDescription
    ? `\n\n用户上传的图片内容：${imageDescription}`
    : '';

  return `你是小禾AI医生助手，一个专业、耐心的医疗咨询助手。

${history}用户问题：${userQuery}${imageContext}

请基于以上对话历史，直接回答用户的问题。回复要求：
1. 简洁明了，直接回答问题
2. 如涉及健康建议，请提醒用户及时就医
3. 使用通俗易懂的语言

现在，请给出你的回复：`;
}

/**
 * 利用提取的实体优化查询
 */
function buildOptimizedQuery(userQuery: string, extractedInfo: any): string {
  if (!extractedInfo) return userQuery;

  const parts = [userQuery];

  if (extractedInfo.symptoms?.length) {
    parts.push(extractedInfo.symptoms.join(' '));
  }
  if (extractedInfo.medicines?.length) {
    parts.push(extractedInfo.medicines.join(' '));
  }
  if (extractedInfo.bodyParts?.length) {
    parts.push(extractedInfo.bodyParts.join(' '));
  }

  // 去重并拼接
  const uniqueParts = [...new Set(parts.join(' ').split(' '))];
  return uniqueParts.join(' ');
}
export async function quickResponse(
  state: AgentStateType
): Promise<Partial<AgentStateType>> {
  const {
    messages,
    conversationId,
    messageId,
    userId,
    eventEmitter,
    startTime,
    primaryIntent,
    extractedInfo,
    imageDescription,
  } = state;

  const userQuery = messages[messages.length - 1].content;
  const optimizedQuery = buildOptimizedQuery(userQuery, extractedInfo);

  try {
    // 1. 根据意图选择工具策略
    const strategy = getToolStrategy(primaryIntent);
    console.log(`[QuickResponse] 工具策略: ${strategy}, 优化查询: ${optimizedQuery}`);

    // === 处理 llm_only 策略：直接调用 LLM ===
    if (strategy === 'llm_only') {
      console.log('[QuickResponse] llm_only 策略，直接调用 LLM');
      const llm = createDeepSeekLLM(0.7);
      const prompt = buildDirectResponsePrompt(messages, userQuery, primaryIntent, imageDescription);
      await streamLLMResponse(llm, prompt, conversationId, messageId, eventEmitter);

      const duration = startTime ? Date.now() - startTime : 0;
      eventEmitter.emit(
        'conversation:end',
        createConversationEndEvent(conversationId, messageId, duration, messages.length)
      );

      console.log(`✅ QuickResponse (llm_only) completed for ${conversationId}, duration: ${duration}ms`);
      return { isFinished: true, toolsUsed: [] };
    }

    let kbResult: any = null;
    let webResult: any = null;

    // 2. 根据策略调用工具
    if (strategy === 'kb_only' || strategy === 'kb_first') {
      kbResult = await queryKnowledgeBase(
        { query: optimizedQuery },
        { conversationId, messageId, userId, userIntent: [], eventEmitter, iteration: 1 }
      );
    }

    if (strategy === 'web_only' || strategy === 'web_first') {
      webResult = await searchWeb(
        { query: optimizedQuery },
        { conversationId, messageId, userId, userIntent: [], eventEmitter, iteration: 1 }
      );
    }

    // 3. 如果优先策略没有结果，退而求其次
    if (strategy === 'kb_first' && (!kbResult?.success || !kbResult?.result?.hasResults)) {
      console.log('[QuickResponse] 知识库无结果，退而使用 webSearch');
      webResult = await searchWeb(
        { query: optimizedQuery },
        { conversationId, messageId, userId, userIntent: [], eventEmitter, iteration: 1 }
      );
    }

    if (strategy === 'web_first' && (!webResult?.success || !webResult?.result?.hasResults)) {
      console.log('[QuickResponse] webSearch 无结果，退而使用知识库');
      kbResult = await queryKnowledgeBase(
        { query: optimizedQuery },
        { conversationId, messageId, userId, userIntent: [], eventEmitter, iteration: 1 }
      );
    }

    // 4. 选择数据源
    const useKnowledgeBase = kbResult?.success && kbResult?.result?.hasResults;
    const selectedResult = useKnowledgeBase ? kbResult : webResult;
    const informationSource: 'knowledge_base' | 'web_search' = useKnowledgeBase
      ? 'knowledge_base'
      : 'web_search';

    console.log(`[QuickResponse] 使用数据源: ${informationSource}`);

    // === 工具无结果时，使用 LLM 兌底 ===
    if (!selectedResult?.success || !selectedResult?.result?.hasResults) {
      console.log('[QuickResponse] 工具无结果，使用 LLM 兌底回复');
      const llm = createDeepSeekLLM(0.7);
      const prompt = buildDirectResponsePrompt(messages, userQuery, primaryIntent, imageDescription);
      await streamLLMResponse(llm, prompt, conversationId, messageId, eventEmitter);

      const duration = startTime ? Date.now() - startTime : 0;
      eventEmitter.emit(
        'conversation:end',
        createConversationEndEvent(conversationId, messageId, duration, messages.length)
      );

      console.log(`✅ QuickResponse (LLM fallback) completed for ${conversationId}, duration: ${duration}ms`);
      return { isFinished: true, toolsUsed: [] };
    }

    // 5. 构建 Prompt
    const resultContent = useKnowledgeBase
      ? selectedResult.result.content || ''
      : formatWebSearchResult(selectedResult?.result);

    const prompt = buildQuickResponsePrompt(userQuery, resultContent, informationSource, primaryIntent);

    // 4. 流式 LLM 调用并实时发送给用户
    console.log('[QuickResponse] 流式调用 LLM...');
    const llm = createDeepSeekLLM(0.7);
    await streamLLMResponse(llm, prompt, conversationId, messageId, eventEmitter);

    // 6. 发送对话结束事件
    const duration = startTime ? Date.now() - startTime : 0;
    eventEmitter.emit(
      'conversation:end',
      createConversationEndEvent(
        conversationId,
        messageId,
        duration,
        messages.length
      )
    );

    console.log(`✅ QuickResponse completed for ${conversationId}, duration: ${duration}ms`);

    return {
      isFinished: true,
      toolsUsed: [useKnowledgeBase ? 'query_knowledge_base' : 'search_web'],
    };
  } catch (error) {
    console.error('[QuickResponse] Error:', error);

    // 即使出错也要发送对话结束事件
    const duration = startTime ? Date.now() - startTime : 0;
    eventEmitter.emit(
      'conversation:end',
      createConversationEndEvent(
        conversationId,
        messageId,
        duration,
        messages.length
      )
    );

    return {
      isFinished: true,
      fallbackResponse: '抱歉，我遇到了技术问题。请稍后再试。',
    };
  }
}

/**
 * 格式化 webSearch 结果为文本
 */
function formatWebSearchResult(result: any): string {
  if (!result.hasResults || !result.sources || result.sources.length === 0) {
    return '未找到相关信息';
  }

  let formatted = '';
  result.sources.forEach((source: any, index: number) => {
    formatted += `来源 ${index + 1}: ${source.title}\n`;
    formatted += `${source.content}\n\n`;
  });

  return formatted;
}
