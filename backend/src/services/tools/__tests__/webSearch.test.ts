import { describe, it, expect, beforeEach, vi } from 'vitest';
import { searchWeb, summarizeWebpageContent, formatWebSearch } from '../webSearch';
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

// Mock @langchain/openai
const mockInvoke = vi.hoisted(() => vi.fn());
const mockLLMInstance = {
  invoke: mockInvoke,
};

vi.mock('@langchain/openai', () => {
  class MockChatOpenAI {
    constructor() {
      return mockLLMInstance;
    }
  }
  return {
    ChatOpenAI: MockChatOpenAI,
  };
});

// Mock ../../utils/llm
const mockCreateZhipuLLM = vi.hoisted(() => vi.fn(() => mockLLMInstance));

vi.mock('../../utils/llm', () => {
  return {
    createZhipuLLM: mockCreateZhipuLLM,
  };
});

describe('WebSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearch.mockReset();
    mockInvoke.mockReset();
    mockTavily.mockReset();
    mockCreateZhipuLLM.mockReset();
    
    // 设置环境变量
    process.env.TAVILY_API_KEY = 'test-tavily-api-key';
    process.env.ZHIPU_API_KEY = 'test-zhipu-api-key';
    
    // 重置 mock 返回值
    mockTavily.mockReturnValue({
      search: mockSearch,
    });
    mockCreateZhipuLLM.mockReturnValue(mockLLMInstance);
  });

  describe('searchWeb', () => {
    it('should successfully search and return summary results', async () => {
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

      const mockLLMResponse = {
        content: JSON.stringify({
          summary: '感冒的主要症状包括发热、咳嗽、流鼻涕。治疗方法包括休息、多喝水。预防措施包括勤洗手、保持室内通风。',
          key_excerpts: '发热、咳嗽、流鼻涕；休息、多喝水；勤洗手、保持室内通风',
        }),
      };

      mockSearch.mockResolvedValue(mockTavilyResponse);
      // mockInvoke 会被调用一次（总体摘要）
      mockInvoke.mockResolvedValue(mockLLMResponse);

      const result = await searchWeb('感冒的症状');

      expect(result).toEqual({
        hasResults: true,
        summary: '感冒的主要症状包括发热、咳嗽、流鼻涕。治疗方法包括休息、多喝水。预防措施包括勤洗手、保持室内通风。',
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
      expect(mockInvoke).not.toHaveBeenCalled();
    });

    it('should use LLM to summarize webpage content', async () => {
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

      const mockLLMResponse = {
        content: JSON.stringify({
          summary: '这是摘要后的内容',
          key_excerpts: '关键信息点',
        }),
      };

      mockSearch.mockResolvedValue(mockTavilyResponse);
      mockInvoke.mockResolvedValue(mockLLMResponse);

      const result = await searchWeb('测试查询');

      expect(mockInvoke).toHaveBeenCalledTimes(1); // 只调用一次（总体摘要）
      expect(result.summary).toBe('这是摘要后的内容');
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

  describe('summarizeWebpageContent', () => {
    it('should summarize webpage content using LLM', async () => {
      const mockLLMResponse = {
        content: JSON.stringify({
          summary: '这是摘要内容',
          key_excerpts: '关键摘录',
        }),
      };

      mockInvoke.mockResolvedValue(mockLLMResponse);

      const result = await summarizeWebpageContent('网页内容', '2024-01-01');

      expect(result).toEqual({
        summary: '这是摘要内容',
        key_excerpts: '关键摘录',
      });

      expect(mockInvoke).toHaveBeenCalled();
    });

    it('should handle LLM response parsing errors', async () => {
      const mockLLMResponse = {
        content: 'Invalid JSON response',
      };

      mockInvoke.mockResolvedValue(mockLLMResponse);

      await expect(
        summarizeWebpageContent('网页内容', '2024-01-01')
      ).rejects.toThrow();
    });
  });

  describe('formatWebSearch', () => {
    it('should format web search result correctly', () => {
      const result: WebSearchResult = {
        hasResults: true,
        summary: '这是搜索结果摘要',
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

      expect(formatted).toContain('这是搜索结果摘要');
      expect(formatted).toContain('标题1');
      expect(formatted).toContain('https://example.com/1');
      expect(formatted).toContain('标题2');
      expect(formatted).toContain('https://example.com/2');
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
