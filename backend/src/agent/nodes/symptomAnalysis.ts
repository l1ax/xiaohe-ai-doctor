import { AgentState } from "../state";
import { createZhipuLLM } from "../../utils/llm";
import {
  createToolCallEvent,
  createMessageContentEvent,
  createMessageMetadataEvent,
} from "../events/chat-event-types";
import { orchestrateTools } from "../../services/tools/toolOrchestrator";
import { v4 as uuidv4 } from 'uuid';

const llm = createZhipuLLM(0.7);

const SYMPTOM_PROMPT = `你是一位专业的医疗健康顾问。用户描述了一些症状，请进行专业分析。

用户症状: {query}

请提供：
1. 可能的原因分析
2. 初步建议
3. 是否需要就医的判断

注意：
- 提供专业建议，但要通俗易懂
- 强调这只是参考，严重情况需就医
- 语气温和、关切`;

export async function symptomAnalysis(state: typeof AgentState.State) {
  const emitter = state.eventEmitter;
  const { conversationId, messages, userIntent } = state;
  const lastMessage = messages[messages.length - 1];
  const userQuery = lastMessage.content;

  const messageId = state.messageId || `msg_${Date.now()}`;
  const toolId = `tool_${uuidv4()}`;

  // 发送工具调用开始事件
  emitter.emit('tool:call', createToolCallEvent(
    conversationId,
    toolId,
    'symptom_analysis',
    messageId,
    'running',
    { input: { query: userQuery } }
  ));

  // 调用工具编排器
  const toolResult = await orchestrateTools({
    query: userQuery,
    intent: userIntent!,
    imageUrls: lastMessage.imageUrls,
    conversationId,
    messageId,
    eventEmitter: emitter,
  });

  // 构建增强 Prompt
  let enhancedPrompt = SYMPTOM_PROMPT.replace('{query}', userQuery);

  if (toolResult.success && toolResult.data) {
    if (toolResult.data.imageDescription) {
      enhancedPrompt += `\n\n【图片信息】\n${toolResult.data.imageDescription}`;
    }
    if (toolResult.data.knowledgeBase) {
      enhancedPrompt += `\n\n【知识库参考】\n${toolResult.data.knowledgeBase}\n\n请优先基于知识库内容回答。`;
    }
    if (toolResult.data.webSearch) {
      enhancedPrompt += `\n\n【网络搜索结果】\n${toolResult.data.webSearch}\n\n请参考搜索结果回答。`;
    }
    enhancedPrompt += `\n\n请基于以上信息，结合你的专业知识，给出专业建议。`;
  } else {
    console.log('[SymptomAnalysis] No tool results, using pure LLM');
  }

  const prompt = enhancedPrompt;

  // 使用LLM原生流式输出
  let fullContent = '';
  let chunkIndex = 0;
  let isFirst = true;

  const stream = await llm.stream([
    { role: "user", content: prompt },
  ]);

  for await (const chunk of stream) {
    const delta = typeof chunk.content === 'string' ? chunk.content : '';
    if (delta) {
      fullContent += delta;
      emitter.emit('message:content', createMessageContentEvent(
        conversationId,
        messageId,
        delta,
        chunkIndex++,
        isFirst,
        false
      ));
      isFirst = false;
    }
  }

  // 发送结束标记
  emitter.emit('message:content', createMessageContentEvent(
    conversationId,
    messageId,
    '',
    chunkIndex,
    false,
    true
  ));

  const analysis = fullContent;
  console.log('🩺 Symptom analysis completed');

  // 发送工具调用完成事件
  emitter.emit('tool:call', createToolCallEvent(
    conversationId,
    toolId,
    'symptom_analysis',
    messageId,
    'completed',
    { output: { analysis }, duration: 500 }
  ));

  // 发送元数据
  emitter.emit('message:metadata', createMessageMetadataEvent(
    conversationId,
    messageId,
    undefined,
    [
      { type: 'transfer_to_doctor', label: '咨询人工医生', data: { action: 'transfer' } },
      { type: 'book_appointment', label: '预约挂号', data: { action: 'booking' } },
    ],
    {
      symptoms: [],
      possibleConditions: [],
      suggestions: [],
      urgencyLevel: 'low',
    },
    toolResult.toolsUsed
  ));

  return {
    branchResult: analysis,
    messageId,
  };
}
