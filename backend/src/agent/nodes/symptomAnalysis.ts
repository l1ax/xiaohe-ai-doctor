import { AgentState } from "../state";
import { createZhipuLLM } from "../../utils/llm";

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
  const lastMessage = state.messages[state.messages.length - 1];
  const userQuery = lastMessage.content;

  const prompt = SYMPTOM_PROMPT.replace('{query}', userQuery);
  
  const response = await llm.invoke([
    { role: "user", content: prompt },
  ]);

  const analysis = response.content as string;
  console.log('🩺 Symptom analysis completed');

  return {
    branchResult: analysis,
  };
}
