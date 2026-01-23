import { createAgentGraph } from "./graph";
import { Message } from "./types";
import { AgentEventEmitter } from "./events/AgentEventEmitter";

const graph = createAgentGraph();

export async function runAgent(params: {
  messages: Message[];
  conversationId: string;
  eventEmitter?: AgentEventEmitter;
}) {
  const { messages, conversationId, eventEmitter } = params;

  console.log(`\n🤖 Agent started for conversation: ${conversationId}`);

  const result = await graph.invoke({
    messages,
    conversationId,
    eventEmitter: eventEmitter || new AgentEventEmitter(),
  });

  console.log(`✅ Agent completed\n`);

  return result;
}

export { AgentState } from "./state";
export * from "./types";
