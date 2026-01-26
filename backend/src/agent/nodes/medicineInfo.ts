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

const MEDICINE_PROMPT = `你是一位药品咨询顾问。用户询问药品相关问题。

用户问题: {query}

请提供：
1. 药品的基本信息
2. 用法用量建议
3. 注意事项

注意：
- 提供准确的药品信息
- 强调遵医嘱，不可自行用药
- 严重情况需咨询医生
- 语气专业、关切`;

export async function medicineInfo(state: typeof AgentState.State) {
  const emitter = state.eventEmitter;
  const { conversationId, messages, extractedInfo, userIntent } = state;
  const lastMessage = messages[messages.length - 1];
  const userQuery = lastMessage.content;
  const medicineName = extractedInfo?.medicineName || '相关药品';

  const messageId = state.messageId || `msg_${Date.now()}`;
  const toolId = `tool_${uuidv4()}`;

  // 发送工具调用开始事件
  emitter.emit('tool:call', createToolCallEvent(
    conversationId,
    toolId,
    'medicine_info',
    messageId,
    'running',
    { input: { medicineName } }
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
  let enhancedPrompt = MEDICINE_PROMPT.replace('{query}', userQuery);

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
    console.log('[MedicineInfo] No tool results, using pure LLM');
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

  const info = fullContent;
  console.log('💊 Medicine info completed');

  // 发送工具调用完成事件
  emitter.emit('tool:call', createToolCallEvent(
    conversationId,
    toolId,
    'medicine_info',
    messageId,
    'completed',
    { output: { info }, duration: 500 }
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
    branchResult: info,
    messageId,
  };
}
