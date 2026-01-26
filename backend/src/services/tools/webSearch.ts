import { tavily } from '@tavily/core';
import { createZhipuLLM } from '../../utils/llm';
import { WebSearchResult } from './types';
import { SUMMARIZE_WEBPAGE_PROMPT } from './prompts';

/**
 * Tavily API 响应结构
 */
interface TavilySearchResponse {
  results: Array<{
    title: string;
    url: string;
    content: string;
    score?: number;
    published_date?: string;
  }>;
  query: string;
}

/**
 * LLM 摘要响应结构
 */
interface SummaryResponse {
  summary: string;
  key_excerpts: string;
}

/**
 * 搜索网络
 * @param query 搜索查询
 * @returns 搜索结果
 */
export async function searchWeb(query: string): Promise<WebSearchResult> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    throw new Error('TAVILY_API_KEY environment variable is not set');
  }

  // 初始化 Tavily 客户端
  const client = tavily({ apiKey });

  try {
    // 执行搜索（最多 3 条结果）
    const response = (await client.search(query, {
      maxResults: 3,
    })) as unknown as TavilySearchResponse;

    // 如果没有结果，返回空结果
    if (!response.results || response.results.length === 0) {
      return {
        hasResults: false,
        summary: '',
        sources: [],
        source: 'web_search',
      };
    }

    // 构建 sources（使用原始 content）
    const sources = response.results.map((result) => ({
      title: result.title,
      url: result.url,
      content: result.content,
    }));

    // 生成总体摘要
    const overallSummary = await summarizeWebpageContent(
      response.results.map((r) => r.content).join('\n\n'),
      new Date().toISOString().split('T')[0]
    );

    return {
      hasResults: true,
      summary: overallSummary.summary,
      sources,
      source: 'web_search',
    };
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to search web');
  }
}

/**
 * 使用 LLM 摘要网页内容
 * @param content 网页内容
 * @param date 日期字符串
 * @returns 摘要结果
 */
export async function summarizeWebpageContent(
  content: string,
  date: string
): Promise<SummaryResponse> {
  const llm = createZhipuLLM(0); // temperature=0 保证稳定

  const prompt = SUMMARIZE_WEBPAGE_PROMPT(content, date);

  try {
    const response = await llm.invoke([
      {
        role: 'user',
        content: prompt,
      },
    ]);

    const responseContent = typeof response.content === 'string' 
      ? response.content 
      : String(response.content);

    const parsed = JSON.parse(responseContent) as SummaryResponse;
    return parsed;
  } catch (error) {
    // 如果解析失败，返回原始内容作为摘要
    if (error instanceof SyntaxError) {
      throw new Error(`Failed to parse LLM response: ${error.message}`);
    }
    throw error;
  }
}

/**
 * 格式化网络搜索结果
 * @param result 搜索结果
 * @returns 格式化后的字符串
 */
export function formatWebSearch(result: WebSearchResult): string {
  if (!result.hasResults || result.sources.length === 0) {
    return '';
  }

  let formatted = `搜索结果摘要：\n${result.summary}\n\n`;

  formatted += '来源：\n';
  result.sources.forEach((source, index) => {
    formatted += `${index + 1}. ${source.title}\n`;
    formatted += `   URL: ${source.url}\n`;
    formatted += `   摘要: ${source.content}\n\n`;
  });

  return formatted;
}
