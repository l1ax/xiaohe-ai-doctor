import { UserIntent } from '../../agent/types';

/**
 * 图片识别 Prompts - 根据不同意图定制
 */
export const RECOGNITION_PROMPTS: Record<Exclude<UserIntent, 'hospital_recommend'>, string> = {
  symptom_consult: `请详细描述图片中的症状表现，包括：
- 症状的具体特征（颜色、形状、大小）
- 症状的位置和范围
- 可观察到的严重程度
请用专业但易懂的语言描述。`,

  medicine_info: `请识别图片中的药品信息，包括：
- 药品名称（通用名和商品名）
- 规格和剂量
- 生产厂家
- 有效期（如可见）
如果是药品说明书，请提取关键信息。`,

  general_qa: `请描述图片的医疗相关内容，包括：
- 图片的主要内容
- 医疗相关的关键信息
- 任何需要注意的细节`,

  health_advice: `请分析图片中的健康相关信息，包括：
- 健康指标或数据
- 运动、饮食或生活方式相关内容
- 可能的健康建议`,

  emergency: `请紧急评估图片中的情况，包括：
- 紧急程度评估
- 明显的危险信号
- 需要立即关注的问题`,
};

/**
 * 判断意图是否需要图片识别
 */
export function shouldRecognizeImage(intent: UserIntent): boolean {
  return intent !== 'hospital_recommend';
}
