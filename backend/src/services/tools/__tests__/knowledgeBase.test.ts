import { describe, it, expect, beforeEach, vi } from 'vitest';
import { queryKnowledgeBase, formatKnowledgeBase } from '../knowledgeBase';
import { KnowledgeQueryResult } from '../types';

// Mock @coze/api
const mockCreate = vi.hoisted(() => vi.fn());

vi.mock('@coze/api', () => {
  class MockCozeAPI {
    workflows = {
      runs: {
        create: mockCreate,
      },
    };
  }

  return {
    CozeAPI: MockCozeAPI,
    COZE_COM_BASE_URL: 'https://api.coze.com',
  };
});

describe('KnowledgeBase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreate.mockReset();
    // 设置环境变量
    process.env.COZE_API_KEY = 'test-api-key';
    process.env.COZE_BASE_URL = 'https://api.coze.com';
    process.env.COZE_WORKFLOW_ID = 'test-workflow-id';
  });

  describe('queryKnowledgeBase', () => {
    it('should successfully query knowledge base and return results', async () => {
      const mockWorkflowResponse = {
        execute_id: 'test-execute-id',
        output: {
          documents: [
            {
              document_id: 'doc-1',
              output: '这是关于感冒的症状描述：发热、咳嗽、流鼻涕。',
            },
            {
              document_id: 'doc-2',
              output: '感冒的治疗方法包括休息、多喝水、服用退烧药。',
            },
          ],
        },
      };

      mockCreate.mockResolvedValue(mockWorkflowResponse);

      const result = await queryKnowledgeBase('感冒的症状是什么？');

      expect(result).toEqual({
        hasResults: true,
        documents: [
          {
            documentId: 'doc-1',
            output: '这是关于感冒的症状描述：发热、咳嗽、流鼻涕。',
          },
          {
            documentId: 'doc-2',
            output: '感冒的治疗方法包括休息、多喝水、服用退烧药。',
          },
        ],
        source: 'knowledge_base',
      });

      expect(mockCreate).toHaveBeenCalledWith({
        workflow_id: 'test-workflow-id',
        parameters: {
          query: '感冒的症状是什么？',
        },
      });
    });

    it('should return hasResults: false when no results found', async () => {
      const mockWorkflowResponse = {
        execute_id: 'test-execute-id',
        output: {
          documents: [],
        },
      };

      mockCreate.mockResolvedValue(mockWorkflowResponse);

      const result = await queryKnowledgeBase('不存在的疾病');

      expect(result).toEqual({
        hasResults: false,
        documents: [],
        source: 'knowledge_base',
      });
    });

    it('should handle empty documents array', async () => {
      const mockWorkflowResponse = {
        execute_id: 'test-execute-id',
        output: {
          documents: [],
        },
      };

      mockCreate.mockResolvedValue(mockWorkflowResponse);

      const result = await queryKnowledgeBase('test query');

      expect(result.hasResults).toBe(false);
      expect(result.documents).toEqual([]);
    });

    it('should throw error when API fails', async () => {
      mockCreate.mockRejectedValue(new Error('API Error'));

      await expect(queryKnowledgeBase('test query')).rejects.toThrow('API Error');
    });

    it('should throw error when COZE_API_KEY is not set', async () => {
      delete process.env.COZE_API_KEY;

      await expect(queryKnowledgeBase('test query')).rejects.toThrow(
        'COZE_API_KEY environment variable is not set'
      );
    });
  });

  describe('formatKnowledgeBase', () => {
    it('should format knowledge base result correctly', () => {
      const result: KnowledgeQueryResult = {
        hasResults: true,
        documents: [
          {
            documentId: 'doc-1',
            output: '这是关于感冒的症状描述：发热、咳嗽、流鼻涕。',
          },
          {
            documentId: 'doc-2',
            output: '感冒的治疗方法包括休息、多喝水、服用退烧药。',
          },
        ],
        source: 'knowledge_base',
      };

      const formatted = formatKnowledgeBase(result);

      expect(formatted).toContain('doc-1');
      expect(formatted).toContain('这是关于感冒的症状描述：发热、咳嗽、流鼻涕。');
      expect(formatted).toContain('doc-2');
      expect(formatted).toContain('感冒的治疗方法包括休息、多喝水、服用退烧药。');
    });

    it('should handle empty documents array', () => {
      const result: KnowledgeQueryResult = {
        hasResults: false,
        documents: [],
        source: 'knowledge_base',
      };

      const formatted = formatKnowledgeBase(result);

      expect(formatted).toBe('');
    });
  });
});
