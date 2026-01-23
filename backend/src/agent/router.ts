import { AgentState } from "./state";

/**
 * 根据用户意图路由到不同的处理分支
 */
export function routeByIntent(state: typeof AgentState.State): string {
  const { userIntent } = state;
  
  switch (userIntent) {
    case 'symptom_consult':
      return 'symptomAnalysis';
    case 'general_qa':
      return 'consultation';
    case 'hospital_recommend':
      return 'hospitalRecommend';
    case 'medicine_info':
      return 'medicineInfo';
    default:
      // 默认走通用问诊分支
      return 'consultation';
  }
}
