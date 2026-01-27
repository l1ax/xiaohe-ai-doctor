import type { UserIntent, RiskIndicators } from '../types';

/**
 * 根据用户意图生成指导信息
 */
export function buildIntentGuidance(
  intents: UserIntent[],
  riskIndicators: Partial<RiskIndicators>
): string {
  const guidances: string[] = [];

  // 紧急情况优先
  if (intents.includes('emergency') || riskIndicators.hasEmergencyKeywords) {
    guidances.push(`
⚠️ **紧急情况处理**：
- 用户可能处于紧急状态
- 优先询问关键症状（持续时间、严重程度）
- 如确认紧急 → 立即建议就医，不要延误
- 可以拨打 120 急救电话
`);
  }

  // 症状咨询
  if (intents.includes('symptom_consult')) {
    guidances.push(`
📋 **症状咨询流程**：
1. 收集症状详情（部位、程度、持续时间、伴随症状）
2. 使用 query_knowledge_base 查询专业信息
3. 评估风险等级
4. 给出建议（缓解方法、就医建议）
`);
  }

  // 药品咨询
  if (intents.includes('medicine_info')) {
    guidances.push(`
💊 **药品咨询流程**：
1. 了解用途（治疗什么症状）
2. 使用 query_knowledge_base 查询药品信息
3. 说明用法用量、注意事项
4. 提醒：具体用药需遵医嘱
`);
  }

  // 医院推荐
  if (intents.includes('hospital_recommend')) {
    guidances.push(`
🏥 **医院推荐流程**：
1. 了解就诊需求（科室、地区）
2. 使用 search_web 查询医院信息
3. 推荐合适的医院和科室
`);
  }

  // 健康建议
  if (intents.includes('health_advice')) {
    guidances.push(`
🌿 **健康建议流程**：
1. 了解用户健康目标
2. 使用 query_knowledge_base 获取科学建议
3. 给出实用、安全的建议
`);
  }

  // 通用咨询
  if (intents.includes('general_qa')) {
    guidances.push(`
❓ **通用咨询流程**：
1. 理解用户问题
2. 优先使用 query_knowledge_base
3. 必要时使用 search_web
4. 清晰回答，必要时追问
`);
  }

  return guidances.join('\n');
}

/**
 * 生成优先级提醒
 */
export function buildPriorityReminder(): string {
  return `
📌 **信息来源优先级提醒**：
1. knowledge_base（知识库）→ 最可靠，优先使用
2. web_search（网络搜索）→ 次选，需注明"以上信息来自网络搜索"
3. model_knowledge（内置知识）→ 最后，需添加"以上建议仅供参考，不能替代医生诊断"
`;
}
