import { AgentState } from "../state";
import { createZhipuLLM } from "../../utils/llm";

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
  const lastMessage = state.messages[state.messages.length - 1];
  const userQuery = lastMessage.content;

  const prompt = HOSPITAL_PROMPT.replace('{query}', userQuery);
  
  const response = await llm.invoke([
    { role: "user", content: prompt },
  ]);

  const recommendation = response.content as string;
  console.log('🏥 Hospital recommendation completed');

  return {
    branchResult: recommendation,
  };
}
