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

const CONSULTATION_PROMPT = `你是一位专业的医疗健康顾问助手。请回答用户的医疗健康问题。

用户问题: {query}

要求：
- 提供专业、准确的医学知识
- 语言通俗易懂
- 必要时提醒用户就医
- 涉及用药时强调遵医嘱`;

export async function consultation(state: typeof AgentState.State) {
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
    'consultation',
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
  let enhancedPrompt = CONSULTATION_PROMPT.replace('{query}', userQuery);

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
    console.log('[Consultation] No tool results, using pure LLM');
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

  const answer = fullContent;
  console.log('💬 Consultation completed');

  // 发送工具调用完成事件
  emitter.emit('tool:call', createToolCallEvent(
    conversationId,
    toolId,
    'consultation',
    messageId,
    'completed',
    { output: { answer }, duration: 500 }
  ));

  // 发送元数据
  emitter.emit('message:metadata', createMessageMetadataEvent(
    conversationId,
    messageId,
    undefined,
    [],
    undefined,
    toolResult.toolsUsed
  ));

  return {
    branchResult: answer,
    messageId,
  };
}
