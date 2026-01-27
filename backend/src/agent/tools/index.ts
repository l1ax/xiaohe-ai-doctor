import type { Tool } from './types';
import { askFollowupTool } from './askFollowup';
import { finishTool } from './finish';
import { queryKnowledgeBaseTool } from './queryKnowledgeBase';
import { searchWebTool } from './searchWeb';

/**
 * 工具优先级
 */
export const P0_TOOLS = [
  'ask_followup_question',
  'query_knowledge_base',
  'search_web',
  'finish',
] as const;

export const P1_TOOLS = [
  'assess_risk',
  'check_emergency',
  'recommend_medicine',
  'provide_advice',
] as const;

export const P2_TOOLS = [
  'analyze_image',
  'recommend_hospital',
] as const;

/**
 * 工具注册表
 */
const TOOL_REGISTRY: Map<string, Tool> = new Map();

// 注册 P0 工具
TOOL_REGISTRY.set('ask_followup_question', askFollowupTool);
TOOL_REGISTRY.set('query_knowledge_base', queryKnowledgeBaseTool);
TOOL_REGISTRY.set('search_web', searchWebTool);
TOOL_REGISTRY.set('finish', finishTool);

// TODO: P1、P2 工具在后续任务中注册

/**
 * 根据名称获取工具
 */
export function getToolByName(name: string): Tool | undefined {
  return TOOL_REGISTRY.get(name);
}

/**
 * 获取所有已注册的工具
 */
export function getAllTools(): Tool[] {
  return Array.from(TOOL_REGISTRY.values());
}

/**
 * 获取 P0 优先级工具
 */
export function getP0Tools(): Tool[] {
  return P0_TOOLS.map(name => TOOL_REGISTRY.get(name)).filter(Boolean) as Tool[];
}

/**
 * 格式化工具描述（用于 Prompt）
 */
export function formatToolDescriptions(tools: Tool[]): string {
  return tools.map(tool => {
    const params = JSON.stringify(tool.parameters.properties, null, 2);
    const required = tool.parameters.required || [];

    return `
**${tool.name}**
${tool.description}

参数:
${params}

必需参数: ${required.join(', ')}
`.trim();
  }).join('\n\n---\n\n');
}
