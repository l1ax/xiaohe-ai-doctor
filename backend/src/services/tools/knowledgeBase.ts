import { CozeAPI, COZE_COM_BASE_URL } from '@coze/api';
import { KnowledgeQueryResult } from './types';

/**
 * Coze Workflow API 响应结构
 */
interface CozeWorkflowResponse {
  execute_id: string;
  data: string; // JSON 字符串
  code: number;
  msg: string;
}

/**
 * Coze Workflow 数据结构（从 data 字段解析出来的）
 */
interface CozeWorkflowData {
  output?: Array<{
    documentId: string;
    output: string;
  }>;
}

/**
 * 查询知识库
 * @param query 查询内容
 * @returns 知识库查询结果
 */
export async function queryKnowledgeBase(
  query: string
): Promise<KnowledgeQueryResult> {
  const apiKey = process.env.COZE_API_KEY;
  if (!apiKey) {
    throw new Error('COZE_API_KEY environment variable is not set');
  }

  const baseURL = process.env.COZE_BASE_URL || COZE_COM_BASE_URL;
  const workflowId = process.env.COZE_WORKFLOW_ID;
  if (!workflowId) {
    throw new Error('COZE_WORKFLOW_ID environment variable is not set');
  }

  // 初始化 Coze API 客户端
  const client = new CozeAPI({
    token: apiKey,
    baseURL,
  });

  try {
    // 调用 workflow API
    const response = (await client.workflows.runs.create({
      workflow_id: workflowId,
      parameters: {
        query,
      },
    })) as unknown as CozeWorkflowResponse;

    // 检查响应状态
    if (response.code !== 0) {
      throw new Error(`Coze API error: ${response.msg}`);
    }

    // 解析 data 字段（是 JSON 字符串）
    const data: CozeWorkflowData = JSON.parse(response.data);
    const documents = data.output || [];
    const hasResults = documents.length > 0;

    return {
      hasResults,
      documents: documents.map((doc) => ({
        documentId: doc.documentId,
        output: doc.output,
      })),
      source: 'knowledge_base',
    };
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to query knowledge base');
  }
}

/**
 * 格式化知识库查询结果
 * @param result 知识库查询结果
 * @returns 格式化后的字符串
 */
export function formatKnowledgeBase(result: KnowledgeQueryResult): string {
  if (!result.hasResults || result.documents.length === 0) {
    return '';
  }

  return result.documents
    .map((doc) => `[${doc.documentId}]\n${doc.output}`)
    .join('\n\n');
}
