import { describe, it, expect, beforeEach, vi } from 'vitest';
import { searchWeb, formatWebSearch } from '../webSearch';
import { WebSearchResult } from '../types';

// Mock @tavily/core
const mockSearch = vi.hoisted(() => vi.fn());
const mockTavily = vi.hoisted(() => {
  return vi.fn(() => ({
    search: mockSearch,
  }));
});

vi.mock('@tavily/core', () => {
  return {
    tavily: mockTavily,
  };
});

describe('WebSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearch.mockReset();
    mockTavily.mockReset();

    // 设置环境变量
    process.env.TAVILY_API_KEY = 'test-tavily-api-key';

    // 重置 mock 返回值
    mockTavily.mockReturnValue({
      search: mockSearch,
    });
  });

  describe('searchWeb', () => {
    it('should successfully search and return results without LLM summarization', async () => {
      const mockTavilyResponse = {
        results: [
          {
            title: '感冒的症状和治疗',
            url: 'https://example.com/cold-symptoms',
            content: '感冒的主要症状包括发热、咳嗽、流鼻涕等。治疗方法包括休息、多喝水。',
            score: 0.95,
            published_date: '2024-01-01',
          },
          {
            title: '感冒预防措施',
            url: 'https://example.com/cold-prevention',
            content: '预防感冒的方法包括勤洗手、保持室内通风、避免接触患者等。',
            score: 0.88,
            published_date: '2024-01-02',
          },
        ],
        query: '感冒的症状',
      };

      mockSearch.mockResolvedValue(mockTavilyResponse);

      const result = await searchWeb('感冒的症状');

      expect(result).toEqual({
        hasResults: true,
        summary: '1. 感冒的症状和治疗\n2. 感冒预防措施',
        sources: [
          {
            title: '感冒的症状和治疗',
            url: 'https://example.com/cold-symptoms',
            content: '感冒的主要症状包括发热、咳嗽、流鼻涕等。治疗方法包括休息、多喝水。',
          },
          {
            title: '感冒预防措施',
            url: 'https://example.com/cold-prevention',
            content: '预防感冒的方法包括勤洗手、保持室内通风、避免接触患者等。',
          },
        ],
        source: 'web_search',
      });

      expect(mockSearch).toHaveBeenCalledWith('感冒的症状', {
        maxResults: 3,
      });
    });

    it('should return hasResults: false when no results found', async () => {
      const mockTavilyResponse = {
        results: [],
        query: '不存在的疾病',
      };

      mockSearch.mockResolvedValue(mockTavilyResponse);

      const result = await searchWeb('不存在的疾病');

      expect(result).toEqual({
        hasResults: false,
        summary: '',
        sources: [],
        source: 'web_search',
      });

      expect(mockSearch).toHaveBeenCalledWith('不存在的疾病', {
        maxResults: 3,
      });
    });

    it('should return raw content directly without LLM processing', async () => {
      const mockTavilyResponse = {
        results: [
          {
            title: '测试网页',
            url: 'https://example.com/test',
            content: '这是一段很长的网页内容，需要被摘要。包含了很多详细信息。',
            score: 0.9,
            published_date: '2024-01-01',
          },
        ],
        query: '测试查询',
      };

      mockSearch.mockResolvedValue(mockTavilyResponse);

      const result = await searchWeb('测试查询');

      expect(result.summary).toBe('1. 测试网页');
      expect(result.sources[0].content).toBe('这是一段很长的网页内容，需要被摘要。包含了很多详细信息。');
    });

    it('should throw error when TAVILY_API_KEY is not set', async () => {
      delete process.env.TAVILY_API_KEY;

      await expect(searchWeb('test query')).rejects.toThrow(
        'TAVILY_API_KEY environment variable is not set'
      );
    });

    it('should handle API errors gracefully', async () => {
      mockSearch.mockRejectedValue(new Error('Tavily API Error'));

      await expect(searchWeb('test query')).rejects.toThrow('Tavily API Error');
    });
  });

  describe('formatWebSearch', () => {
    it('should format web search result correctly', () => {
      const result: WebSearchResult = {
        hasResults: true,
        summary: '1. 标题1\n2. 标题2',
        sources: [
          {
            title: '标题1',
            url: 'https://example.com/1',
            content: '内容1',
          },
          {
            title: '标题2',
            url: 'https://example.com/2',
            content: '内容2',
          },
        ],
        source: 'web_search',
      };

      const formatted = formatWebSearch(result);

      expect(formatted).toContain('网络搜索结果：');
      expect(formatted).toContain('标题1');
      expect(formatted).toContain('https://example.com/1');
      expect(formatted).toContain('内容1');
      expect(formatted).toContain('标题2');
      expect(formatted).toContain('https://example.com/2');
      expect(formatted).toContain('内容2');
    });

    it('should handle empty results', () => {
      const result: WebSearchResult = {
        hasResults: false,
        summary: '',
        sources: [],
        source: 'web_search',
      };

      const formatted = formatWebSearch(result);

      expect(formatted).toBe('');
    });
  });
});
