import { AgentState } from "../state";
import { createZhipuLLM } from "../../utils/llm";

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
  const lastMessage = state.messages[state.messages.length - 1];
  const userQuery = lastMessage.content;
  const medicineName = state.extractedInfo?.medicineName || '相关药品';

  emitter.emitThinking(`正在查询${medicineName}的药品信息...`);

  emitter.emitToolCall('medicine_query', 'running', {
    input: { medicineName },
  });

  const prompt = MEDICINE_PROMPT.replace('{query}', userQuery);

  const response = await llm.invoke([
    { role: "user", content: prompt },
  ]);

  const info = response.content as string;
  console.log('💊 Medicine info completed');

  emitter.emitToolCall('medicine_query', 'completed', {
    output: { info },
  });

  // Emit content character by character
  for (const char of info) {
    emitter.emitContent(char);
  }

  return {
    branchResult: info,
  };
}
