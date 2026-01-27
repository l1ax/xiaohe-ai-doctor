import { tavily } from '@tavily/core';
import { WebSearchResult } from './types';

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
 * 搜索网络
 * @param query 搜索查询
 * @returns 搜索结果
 */
export async function searchWeb(query: string): Promise<WebSearchResult> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    throw new Error('TAVILY_API_KEY environment variable is not set');
  }

  const client = tavily({ apiKey });

  try {
    const response = (await client.search(query, {
      maxResults: 3,
    })) as unknown as TavilySearchResponse;

    if (!response.results || response.results.length === 0) {
      return {
        hasResults: false,
        summary: '',
        sources: [],
        source: 'web_search',
      };
    }

    // 直接使用 Tavily 返回的内容，不再调用 LLM 摘要
    const sources = response.results.map((result) => ({
      title: result.title,
      url: result.url,
      content: result.content,
    }));

    // summary 字段使用简单拼接（用于向后兼容）
    const summary = sources.map((s, i) => `${i + 1}. ${s.title}`).join('\n');

    return {
      hasResults: true,
      summary,
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
 * 格式化网络搜索结果
 * @param result 搜索结果
 * @returns 格式化后的字符串
 */
export function formatWebSearch(result: WebSearchResult): string {
  if (!result.hasResults || result.sources.length === 0) {
    return '';
  }

  let formatted = '网络搜索结果：\n\n';

  result.sources.forEach((source, index) => {
    formatted += `${index + 1}. ${source.title}\n`;
    formatted += `   URL: ${source.url}\n`;
    formatted += `   内容: ${source.content}\n\n`;
  });

  return formatted;
}
