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

const HOSPITAL_PROMPT = `你是一位医疗咨询顾问。用户想要咨询医院推荐。

用户需求: {query}

请提供：
1. 根据用户需求推荐合适的医院科室
2. 就医建议

注意：
- MVP阶段只提供通用建议和科室推荐
- 告知用户可通过平台预约功能查看具体医院
- 语气专业、友好`;

export async function hospitalRecommend(state: typeof AgentState.State) {
  const emitter = state.eventEmitter;
  const { conversationId, messages, extractedInfo, userIntent } = state;
  const lastMessage = messages[messages.length - 1];
  const userQuery = lastMessage.content;
  const location = extractedInfo?.location || '您的地区';

  const messageId = state.messageId || `msg_${Date.now()}`;
  const toolId = `tool_${uuidv4()}`;

  // 发送工具调用开始事件
  emitter.emit('tool:call', createToolCallEvent(
    conversationId,
    toolId,
    'hospital_recommend',
    messageId,
    'running',
    { input: { query: userQuery, location } }
  ));

  // 调用工具编排器（不传递 imageUrls）
  const toolResult = await orchestrateTools({
    query: userQuery,
    intent: userIntent!,
    imageUrls: undefined,  // hospitalRecommend 不识别图片
    conversationId,
    messageId,
    eventEmitter: emitter,
  });

  // 构建增强 Prompt
  let enhancedPrompt = HOSPITAL_PROMPT.replace('{query}', userQuery);

  if (toolResult.success && toolResult.data) {
    // 注意：hospitalRecommend 不处理图片，所以不会有 imageDescription
    if (toolResult.data.knowledgeBase) {
      enhancedPrompt += `\n\n【知识库参考】\n${toolResult.data.knowledgeBase}\n\n请优先基于知识库内容回答。`;
    }
    if (toolResult.data.webSearch) {
      enhancedPrompt += `\n\n【网络搜索结果】\n${toolResult.data.webSearch}\n\n请参考搜索结果回答。`;
    }
    enhancedPrompt += `\n\n请基于以上信息，结合你的专业知识，给出专业建议。`;
  } else {
    console.log('[HospitalRecommend] No tool results, using pure LLM');
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

  const recommendation = fullContent;
  console.log('🏥 Hospital recommendation completed');

  // 发送工具调用完成事件
  emitter.emit('tool:call', createToolCallEvent(
    conversationId,
    toolId,
    'hospital_recommend',
    messageId,
    'completed',
    { output: { recommendation }, duration: 500 }
  ));

  // 发送元数据
  emitter.emit('message:metadata', createMessageMetadataEvent(
    conversationId,
    messageId,
    undefined,
    [
      { type: 'book_appointment', label: '预约挂号', data: { location } },
    ],
    undefined,
    toolResult.toolsUsed
  ));

  return {
    branchResult: recommendation,
    messageId,
  };
}
