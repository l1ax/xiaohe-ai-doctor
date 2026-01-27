import 'dotenv/config';
import { StateGraph, END } from '@langchain/langgraph';
import { AgentState } from './state';
import { classifyIntent } from './nodes/classifyIntent';
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
 * 创建 Agent 图
 *
 * 流程：classifyIntent → reactLoop (循环) → finalResponse → END
 */
export function createAgentGraph() {
  const workflow = new StateGraph(AgentState)
    // 添加节点
    .addNode('classifyIntent', classifyIntent)
    .addNode('reactLoop', reactLoop)
    .addNode('finalResponse', finalResponse)

    // 入口：意图分类
    .addEdge('__start__', 'classifyIntent')

    // 意图分类后进入 ReAct 循环
    .addEdge('classifyIntent', 'reactLoop')

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
