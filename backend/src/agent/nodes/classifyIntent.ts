import type { AgentStateType } from '../state';
import type { UserIntent } from '../types';
import { createZhipuLLM } from '../../utils/llm';

/**
 * 意图识别节点 - 升级支持多意图和风险指标
 */
export async function classifyIntent(
  state: AgentStateType
): Promise<Partial<AgentStateType>> {
  const { messages, conversationId, eventEmitter } = state;
  const latestMessage = messages[messages.length - 1];

  try {
    const llm = createZhipuLLM(0.3);

    const prompt = `你是医疗意图识别助手。分析用户消息，识别所有意图并提取信息。

可能的意图类型：
- symptom_consult: 症状咨询
- medicine_info: 药品信息
- hospital_recommend: 医院推荐
- health_advice: 健康建议
- general_qa: 通用问答
- emergency: 紧急情况

用户消息: ${latestMessage.content}

请以 JSON 格式返回：
{
  "intents": ["主要意图", "次要意图"],
  "entities": {
    "symptoms": ["症状1"],
    "medicines": ["药品1"],
    "bodyParts": ["部位1"]
  },
  "riskIndicators": {
    "hasEmergencyKeywords": false,
    "severity": "mild"  // mild | moderate | severe
  }
}`;

    const response = await llm.invoke([
      { role: "user", content: prompt },
    ]);
    const content = typeof response.content === 'string'
      ? response.content
      : JSON.stringify(response.content);

    // 清理可能的 markdown 代码块
    const cleanContent = content
      .replace(/```json\s*/g, '')
      .replace(/```\s*/g, '')
      .trim();

    const parsed = JSON.parse(cleanContent);

    // 提取意图列表
    const intents: UserIntent[] = parsed.intents || [];
    const primaryIntent = intents[0] || 'general_qa';

    // 计算置信度（简化版）
    const intentConfidence: Partial<Record<UserIntent, number>> = {};
    intents.forEach((intent: UserIntent, index: number) => {
      intentConfidence[intent] = 1.0 - (index * 0.2);
    });

    // 发送意图识别事件
    eventEmitter.emit('agent:intent', {
      conversationId,
      intents,
      primaryIntent,
      entities: parsed.entities || {},
      riskIndicators: parsed.riskIndicators || {
        hasEmergencyKeywords: false,
        severity: 'mild',
      },
    });

    return {
      userIntent: intents,
      primaryIntent,
      intentConfidence,
      extractedInfo: parsed.entities || {},
      riskIndicators: parsed.riskIndicators || {
        hasEmergencyKeywords: false,
        severity: 'mild',
      },
    };
  } catch (error) {
    console.error('[ClassifyIntent] Error:', error);

    // 降级：返回通用意图
    return {
      userIntent: ['general_qa'],
      primaryIntent: 'general_qa',
      intentConfidence: { general_qa: 0.5 },
      extractedInfo: {},
      riskIndicators: {
        hasEmergencyKeywords: false,
        severity: 'mild',
      },
    };
  }
}
