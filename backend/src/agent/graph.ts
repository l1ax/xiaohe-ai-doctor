import { StateGraph, END } from "@langchain/langgraph";
import { AgentState } from "./state";
import { classifyIntent } from "./nodes/classifyIntent";
import { symptomAnalysis } from "./nodes/symptomAnalysis";
import { consultation } from "./nodes/consultation";
import { hospitalRecommend } from "./nodes/hospitalRecommend";
import { medicineInfo } from "./nodes/medicineInfo";
import { synthesizeResponse } from "./nodes/synthesizeResponse";
import { routeByIntent } from "./router";

export function createAgentGraph() {
  const workflow = new StateGraph(AgentState)
    // 添加节点
    .addNode("classifyIntent", classifyIntent)
    .addNode("symptomAnalysis", symptomAnalysis)
    .addNode("consultation", consultation)
    .addNode("hospitalRecommend", hospitalRecommend)
    .addNode("medicineInfo", medicineInfo)
    .addNode("synthesizeResponse", synthesizeResponse)
    
    // 入口：意图分类
    .addEdge("__start__", "classifyIntent")
    
    // 条件路由：根据意图分发到不同分支
    .addConditionalEdges(
      "classifyIntent",
      routeByIntent,
      {
        symptomAnalysis: "symptomAnalysis",
        consultation: "consultation",
        hospitalRecommend: "hospitalRecommend",
        medicineInfo: "medicineInfo",
      }
    )
    
    // 各分支都汇聚到综合回答
    .addEdge("symptomAnalysis", "synthesizeResponse")
    .addEdge("consultation", "synthesizeResponse")
    .addEdge("hospitalRecommend", "synthesizeResponse")
    .addEdge("medicineInfo", "synthesizeResponse")
    
    // 综合回答后结束
    .addEdge("synthesizeResponse", END);

  return workflow.compile();
}
