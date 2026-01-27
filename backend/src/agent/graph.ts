import 'dotenv/config';
import { StateGraph, END } from '@langchain/langgraph';
import { AgentState } from './state';
import { classifyIntent } from './nodes/classifyIntent';
import { quickResponse } from './nodes/quickResponse';
import { reactLoop } from './nodes/reactLoop';
import { finalResponse } from './nodes/finalResponse';

/**
 * 决定 ReAct 循环是否继续
 */
function shouldContinueLoop(state: typeof AgentState.State): string {
  const { isFinished } = state;

  if (isFinished) {
    return 'finalResponse';
  }

  return 'reactLoop';
}

/**
 * 决定使用快速响应还是 ReAct 循环
 */
function shouldUseQuickResponse(state: typeof AgentState.State): string {
  const { routeDecision } = state;

  if (routeDecision === 'quick') {
    console.log('[Graph] 路由到快速响应节点');
    return 'quickResponse';
  }

  console.log('[Graph] 路由到 ReAct 循环');
  return 'reactLoop';
}

/**
 * 创建 Agent 图
 *
 * 流程：
 * - classifyIntent（意图分类 + 路由决策）
 *   ├─ 简单意图 → quickResponse（快速通道）→ END
 *   └─ 复杂意图 → reactLoop（循环）→ finalResponse → END
 */
export function createAgentGraph() {
  const workflow = new StateGraph(AgentState)
    // 添加节点
    .addNode('classifyIntent', classifyIntent)
    .addNode('quickResponse', quickResponse)
    .addNode('reactLoop', reactLoop)
    .addNode('finalResponse', finalResponse)

    // 入口：意图分类
    .addEdge('__start__', 'classifyIntent')

    // 意图分类后根据路由决策选择节点
    .addConditionalEdges(
      'classifyIntent',
      shouldUseQuickResponse,
      {
        quickResponse: 'quickResponse',  // 快速通道
        reactLoop: 'reactLoop',          // ReAct 循环
      }
    )

    // 快速响应直接结束
    .addEdge('quickResponse', END)

    // ReAct 循环条件边：根据 isFinished 决定继续循环还是进入最终响应
    .addConditionalEdges(
      'reactLoop',
      shouldContinueLoop,
      {
        reactLoop: 'reactLoop',         // 继续循环
        finalResponse: 'finalResponse',  // 结束循环
      }
    )

    // 最终响应后结束
    .addEdge('finalResponse', END);

  return workflow.compile();
}
