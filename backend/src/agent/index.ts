import { createAgentGraph } from "./graph";
import { Message } from "./types";
import { AgentEventEmitter } from "./events/AgentEventEmitter";
import { v4 as uuidv4 } from 'uuid';

const graph = createAgentGraph();

export async function runAgent(params: {
  messages: Message[];
  conversationId: string;
  eventEmitter?: AgentEventEmitter;
}) {
  const { messages, conversationId, eventEmitter } = params;

  console.log(`\n🤖 Agent started for conversation: ${conversationId}`);

  const messageId = `msg_${uuidv4()}`;
  const startTime = Date.now();

  const result = await graph.invoke(
    {
      messages,
      conversationId,
      messageId,
      startTime,
      eventEmitter: eventEmitter || new AgentEventEmitter(),
    },
    {
      configurable: { thread_id: conversationId },  // 多轮对话：使用 conversationId 作为 thread_id
    }
  );

  console.log(`✅ Agent completed\n`);

  return result;
}

export { AgentState } from "./state";
export * from "./types";
