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
};

/**
 * 网页摘要 Prompt
 */
export const SUMMARIZE_WEBPAGE_PROMPT = (content: string, date: string): string => `Today's date is ${date}.

You are tasked with summarizing webpage content for research purposes.

**Instructions:**
1. Extract the main topic and key points from the content
2. Identify important facts, statistics, and findings
3. Capture relevant quotes or excerpts that contain valuable information
4. Filter out navigation, ads, and irrelevant boilerplate content
5. Focus on factual information that answers research questions

**Webpage Content:**
${content}

Provide:
1. A concise summary of the main content
2. Key excerpts with important quotes or data points

Return your response in JSON format with:
{
  "summary": "<concise summary of main content>",
  "key_excerpts": "<important quotes and data points>"
}`;

/**
 * 判断意图是否需要图片识别
 */
export function shouldRecognizeImage(intent: UserIntent): boolean {
  return intent !== 'hospital_recommend';
}
