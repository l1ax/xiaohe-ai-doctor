import { createAgentGraph } from "./graph";
import { Message } from "./types";

const graph = createAgentGraph();

export async function runAgent(params: {
  messages: Message[];
  conversationId: string;
}) {
  const { messages, conversationId } = params;

  console.log(`\n🤖 Agent started for conversation: ${conversationId}`);
  
  const result = await graph.invoke({
    messages,
    conversationId,
  });

  console.log(`✅ Agent completed\n`);

  return result;
}

export { AgentState } from "./state";
export * from "./types";
