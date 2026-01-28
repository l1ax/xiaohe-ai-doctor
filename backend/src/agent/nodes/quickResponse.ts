import type { AgentStateType } from '../state';
import { queryKnowledgeBase } from '../tools/queryKnowledgeBase';
import { searchWeb } from '../tools/searchWeb';
import { createZhipuLLM, streamLLMResponse } from '../../utils/llm';
import { buildQuickResponsePrompt } from '../prompts/quickResponsePrompt';
import { createConversationEndEvent } from '../events/chat-event-types';

/**
 * Quick Response 节点 - 快速响应通道
 *
 * 适用场景：症状咨询、用药咨询、健康建议等简单意图
 *
 * 流程：
 * 1. 并行调用知识库和 webSearch
 * 2. 知识库有结果优先使用，否则用 webSearch
 * 3. 单次 LLM 调用生成最终回复
 * 4. 流式发送给用户
 */
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
  } = state;

  const userQuery = messages[messages.length - 1].content;

  try {
    // 1. 并行调用工具
    console.log('[QuickResponse] 并行调用知识库和 webSearch...');
    const [kbResult, webResult] = await Promise.all([
      queryKnowledgeBase(
        { query: userQuery },
        { conversationId, messageId, userId, userIntent: [], eventEmitter, iteration: 1 }
      ),
      searchWeb(
        { query: userQuery },
        { conversationId, messageId, userId, userIntent: [], eventEmitter, iteration: 1 }
      ),
    ]);

    // 2. 选择数据源（知识库优先）
    const useKnowledgeBase = kbResult.success && kbResult.result?.hasResults;
    const selectedResult = useKnowledgeBase ? kbResult : webResult;
    const informationSource: 'knowledge_base' | 'web_search' = useKnowledgeBase
      ? 'knowledge_base'
      : 'web_search';

    console.log(`[QuickResponse] 使用数据源: ${informationSource}`);

    // 检查是否有有效结果
    if (!selectedResult.success || !selectedResult.result) {
      console.error('[QuickResponse] 工具调用失败，使用降级响应');

      // 发送对话结束事件
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
        fallbackResponse: '抱歉，我暂时无法查询到相关信息。请您稍后再试，或者联系人工客服。',
      };
    }

    // 3. 构建 Prompt
    const resultContent = useKnowledgeBase
      ? selectedResult.result.content || ''
      : formatWebSearchResult(selectedResult.result);

    const prompt = buildQuickResponsePrompt(userQuery, resultContent, informationSource);

    // 4. 流式 LLM 调用并实时发送给用户
    console.log('[QuickResponse] 流式调用 LLM...');
    const llm = createZhipuLLM(0.7);
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
