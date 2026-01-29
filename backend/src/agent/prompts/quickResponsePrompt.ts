import type { UserIntent } from '../types';

/**
 * 根据意图获取回复指导
 */
function getIntentGuidance(intent?: UserIntent | null): string {
  switch (intent) {
    case 'medicine_info':
      return '\n## 用药安全提醒\n- 请在回复中包含用药安全注意事项\n- 提醒常见副作用和禁忌';
    case 'symptom_consult':
      return '\n## 回复重点\n- 给出可能的原因和建议措施\n- 说明何时应该就医';
    case 'health_advice':
      return '\n## 回复重点\n- 注重日常保健和预防建议\n- 提供实用的生活方式建议';
    case 'hospital_recommend':
      return '\n## 回复重点\n- 提供具体的医院信息\n- 包含科室和就诊建议';
    default:
      return '';
  }
}

/**
 * 构建快速响应 Prompt
 */
export function buildQuickResponsePrompt(
  userQuery: string,
  resultContent: string,
  informationSource: 'knowledge_base' | 'web_search',
  primaryIntent?: UserIntent | null
): string {
  const sourceLabel = informationSource === 'knowledge_base' ? '专业知识库' : '网络搜索';
  const reliabilityNote = informationSource === 'web_search'
    ? '\n\n⚠️ 注意：以下信息来自网络搜索，请在回复中提醒用户这仅供参考，不能替代专业医生诊断。'
    : '';
  const intentGuidance = getIntentGuidance(primaryIntent);

  return `你是小荷AI医生助手，一个专业、耐心的医疗咨询助手。

# 用户问题

${userQuery}

# ${sourceLabel}查询结果

${resultContent}

# 任务

基于以上信息，给出专业、简洁、易懂的医疗建议。

## 回复要求

1. **直接回答**：开门见山，直接针对用户问题给出建议
2. **结构清晰**：使用分段和要点，易于阅读
3. **专业但易懂**：避免过多医学术语，用通俗语言解释
4. **安全提示**：如有必要，提醒用户及时就医
${intentGuidance}
## 禁止事项

- ❌ 不要追问更多信息（这是快速回复模式）
- ❌ 不要说"让我查询..."（已经查询完毕）
- ❌ 不要过度谨慎（如用户问题明确，直接回答即可）
- ❌ 不要提及"知识库"、"信息来源"、"可信度"等内部术语${reliabilityNote}

现在，请给出你的专业建议：`;
}
