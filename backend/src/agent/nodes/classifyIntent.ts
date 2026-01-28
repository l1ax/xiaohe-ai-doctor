import type { AgentStateType } from '../state';
import type { UserIntent } from '../types';
import { createDeepSeekLLM } from '../../utils/llm';
import { recognizeImage } from '../../services/tools/imageRecognition';

/**
 * 意图识别节点 - 升级支持多意图和风险指标
 */
export async function classifyIntent(
  state: AgentStateType
): Promise<Partial<AgentStateType>> {
  const { messages, conversationId, eventEmitter } = state;
  const latestMessage = messages[messages.length - 1];

  try {
    // === 图片识别：如果有图片，先获取描述 ===
    let imageDescription = '';
    if (latestMessage.imageUrls?.length) {
      console.log('[ClassifyIntent] 检测到图片，调用 recognizeImage...');
      try {
        const result = await recognizeImage(latestMessage.imageUrls[0], { intent: 'general_qa' });
        imageDescription = result.description;
        console.log(`[ClassifyIntent] 图片描述: ${imageDescription.slice(0, 100)}...`);
      } catch (imgError) {
        console.error('[ClassifyIntent] 图片识别失败:', imgError);
      }
    }

    const llm = createDeepSeekLLM(0.3);

    // 构建 prompt，包含图片描述（如果有）
    const imageContext = imageDescription
      ? `\n\n用户上传了一张图片，图片内容描述：${imageDescription}`
      : '';

    const prompt = `你是医疗意图识别助手。分析用户消息，识别所有意图并提取信息。

可能的意图类型：
- symptom_consult: 症状咨询
- medicine_info: 药品信息
- hospital_recommend: 医院推荐
- health_advice: 健康建议
- general_qa: 通用问答
- emergency: 紧急情况

用户消息: ${latestMessage.content}${imageContext}

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

    console.log(`[ClassifyIntent] 识别意图: ${intents.join(', ')} | 主要意图: ${primaryIntent}`);

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

    // ========== 路由决策 ==========
    const routeDecision = determineRoute(
      intents,
      primaryIntent,
      parsed.riskIndicators || { hasEmergencyKeywords: false, severity: 'mild' }
    );
    console.log(`[ClassifyIntent] 路由决策: ${routeDecision}`);

    return {
      userIntent: intents,
      primaryIntent,
      intentConfidence,
      extractedInfo: parsed.entities || {},
      riskIndicators: parsed.riskIndicators || {
        hasEmergencyKeywords: false,
        severity: 'mild',
      },
      routeDecision,
      imageDescription,  // 保存图片描述供后续节点使用
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
      routeDecision: 'react', // 默认走 ReAct
    };
  }
}

/**
 * 决定使用哪个路由
 * 基于意图数量和风险指标进行路由决策
 * 
 * @param intents 识别到的所有意图
 * @param primaryIntent 主要意图
 * @param riskIndicators 风险指标
 * @returns 'quick' 或 'react'
 */
function determineRoute(
  intents: UserIntent[],
  primaryIntent: UserIntent | null,
  riskIndicators: { hasEmergencyKeywords: boolean; severity: string }
): 'quick' | 'react' {
  // 1. 紧急情况 → reactLoop
  if (primaryIntent === 'emergency' || riskIndicators.hasEmergencyKeywords) {
    console.log('[RouteDecision] 紧急情况，走 ReAct 循环');
    return 'react';
  }

  // 2. 高风险 → reactLoop
  if (riskIndicators.severity === 'severe') {
    console.log('[RouteDecision] 高风险场景，走 ReAct 循环');
    return 'react';
  }

  // 3. 混合意图（多意图）→ reactLoop
  if (intents.length > 1) {
    console.log(`[RouteDecision] 多意图(${intents.length}个)，走 ReAct 循环`);
    return 'react';
  }

  // 4. 无意图 → reactLoop（保守策略）
  if (!primaryIntent || intents.length === 0) {
    console.log('[RouteDecision] 无法识别意图，走 ReAct 循环');
    return 'react';
  }

  // 5. 单一意图 + 非紧急 + 非高风险 → quickResponse
  console.log(`[RouteDecision] 单一意图 ${primaryIntent}，走快速通道`);
  return 'quick';
}
