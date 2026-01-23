import { AgentState } from "../state";
import { createZhipuLLM } from "../../utils/llm";

const llm = createZhipuLLM(0.7);

const CONSULTATION_PROMPT = `你是一位专业的医疗健康顾问助手。请回答用户的医疗健康问题。

用户问题: {query}

要求：
- 提供专业、准确的医学知识
- 语言通俗易懂
- 必要时提醒用户就医
- 涉及用药时强调遵医嘱`;

export async function consultation(state: typeof AgentState.State) {
  const lastMessage = state.messages[state.messages.length - 1];
  const userQuery = lastMessage.content;

  const prompt = CONSULTATION_PROMPT.replace('{query}', userQuery);
  
  const response = await llm.invoke([
    { role: "system", content: prompt },
  ]);

  const answer = response.content as string;
  console.log('💬 Consultation completed');

  return {
    branchResult: answer,
  };
}
