import { describe, it, expect, beforeEach, vi } from 'vitest';
import { orchestrateTools } from '../toolOrchestrator';
import { ToolContext } from '../types';
import { AgentEventEmitter } from '../../../agent/events/AgentEventEmitter';
import { recognizeImage } from '../imageRecognition';
import { queryKnowledgeBase, formatKnowledgeBase } from '../knowledgeBase';
import { searchWeb, formatWebSearch } from '../webSearch';

// Mock 所有工具服务
vi.mock('../imageRecognition');
vi.mock('../knowledgeBase', async () => {
  const actual = await vi.importActual('../knowledgeBase');
  return {
    ...actual,
    queryKnowledgeBase: vi.fn(),
  };
});
vi.mock('../webSearch', async () => {
  const actual = await vi.importActual('../webSearch');
  return {
    ...actual,
    searchWeb: vi.fn(),
  };
});

// Mock 事件系统
vi.mock('../../../agent/events/chat-event-types', () => ({
  createToolCallEvent: vi.fn((conversationId, toolId, toolName, messageId, status, options) => ({
    type: 'tool:call',
    data: {
      conversationId,
      toolId,
      toolName,
      messageId,
      status,
      timestamp: new Date().toISOString(),
      ...options,
    },
  })),
}));

describe('ToolOrchestrator', () => {
  let mockEventEmitter: AgentEventEmitter;
  let mockContext: ToolContext;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // 创建 mock event emitter
    mockEventEmitter = {
      emit: vi.fn(),
    } as unknown as AgentEventEmitter;

    mockContext = {
      query: '感冒的症状是什么？',
      intent: 'symptom_consult',
      conversationId: 'conv-123',
      messageId: 'msg-456',
      eventEmitter: mockEventEmitter,
    };
  });

  describe('orchestrateTools', () => {
    it('should successfully execute image recognition + knowledge base query', async () => {
      const mockImageResult = {
        description: '图片显示皮肤出现红色斑块',
      };
      const mockKnowledgeResult = {
        hasResults: true,
        documents: [
          {
            documentId: 'doc-1',
            output: '感冒的主要症状包括发热、咳嗽、流鼻涕。',
          },
        ],
        source: 'knowledge_base' as const,
      };

      vi.mocked(recognizeImage).mockResolvedValue(mockImageResult);
      vi.mocked(queryKnowledgeBase).mockResolvedValue(mockKnowledgeResult);

      const context: ToolContext = {
        ...mockContext,
        imageUrls: ['https://example.com/image.jpg'],
      };

      const result = await orchestrateTools(context);

      expect(result.success).toBe(true);
      expect(result.data?.imageDescription).toBe('图片显示皮肤出现红色斑块');
      expect(result.data?.knowledgeBase).toBeTruthy();
      expect(result.toolsUsed).toContain('image_recognition');
      expect(result.toolsUsed).toContain('knowledge_base');
      expect(result.enhancedQuery).toContain('图片显示皮肤出现红色斑块');
      
      // 验证图片识别被调用
      expect(recognizeImage).toHaveBeenCalledWith('https://example.com/image.jpg', {
        intent: 'symptom_consult',
      });
      
      // 验证知识库查询被调用（使用增强后的查询）
      expect(queryKnowledgeBase).toHaveBeenCalled();
      // 验证查询包含图片描述
      const knowledgeCall = vi.mocked(queryKnowledgeBase).mock.calls[0];
      expect(knowledgeCall[0]).toContain('图片显示皮肤出现红色斑块');
      
      // 验证事件被发送
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'tool:call',
        expect.objectContaining({
          data: expect.objectContaining({
            toolName: 'image_recognition',
            status: 'running',
          }),
        })
      );
    });

    it('should fallback to web search when knowledge base has no results', async () => {
      const mockKnowledgeResult = {
        hasResults: false,
        documents: [],
        source: 'knowledge_base' as const,
      };
      const mockWebSearchResult = {
        hasResults: true,
        summary: '感冒的主要症状包括发热、咳嗽、流鼻涕。',
        sources: [
          {
            title: '感冒症状',
            url: 'https://example.com',
            content: '感冒的主要症状...',
          },
        ],
        source: 'web_search' as const,
      };

      vi.mocked(queryKnowledgeBase).mockResolvedValue(mockKnowledgeResult);
      vi.mocked(searchWeb).mockResolvedValue(mockWebSearchResult);

      const result = await orchestrateTools(mockContext);

      expect(result.success).toBe(true);
      expect(result.data?.knowledgeBase).toBeUndefined();
      expect(result.data?.webSearch).toBeTruthy();
      expect(result.toolsUsed).toContain('knowledge_base');
      expect(result.toolsUsed).toContain('web_search');
      
      // 验证知识库查询被调用
      expect(queryKnowledgeBase).toHaveBeenCalledWith('感冒的症状是什么？');
      
      // 验证网络搜索被调用（降级）
      expect(searchWeb).toHaveBeenCalledWith('感冒的症状是什么？');
    });

    it('should return failure status when all tools fail', async () => {
      vi.mocked(queryKnowledgeBase).mockRejectedValue(new Error('Knowledge base error'));
      vi.mocked(searchWeb).mockRejectedValue(new Error('Web search error'));

      const result = await orchestrateTools(mockContext);

      expect(result.success).toBe(false);
      expect(result.data).toBeUndefined();
      expect(result.toolsUsed).toContain('knowledge_base');
      expect(result.toolsUsed).toContain('web_search');
      
      // 验证两个工具都被调用
      expect(queryKnowledgeBase).toHaveBeenCalled();
      expect(searchWeb).toHaveBeenCalled();
    });

    it('should not call image recognition for hospital_recommend intent', async () => {
      const mockKnowledgeResult = {
        hasResults: true,
        documents: [
          {
            documentId: 'doc-1',
            output: '推荐医院信息',
          },
        ],
        source: 'knowledge_base' as const,
      };

      vi.mocked(queryKnowledgeBase).mockResolvedValue(mockKnowledgeResult);

      const context: ToolContext = {
        ...mockContext,
        intent: 'hospital_recommend',
        imageUrls: ['https://example.com/image.jpg'],
      };

      const result = await orchestrateTools(context);

      expect(result.success).toBe(true);
      expect(result.data?.imageDescription).toBeUndefined();
      expect(result.toolsUsed).not.toContain('image_recognition');
      expect(result.toolsUsed).toContain('knowledge_base');
      
      // 验证图片识别没有被调用
      expect(recognizeImage).not.toHaveBeenCalled();
    });

    it('should continue when image recognition fails', async () => {
      const mockKnowledgeResult = {
        hasResults: true,
        documents: [
          {
            documentId: 'doc-1',
            output: '知识库结果',
          },
        ],
        source: 'knowledge_base' as const,
      };

      vi.mocked(recognizeImage).mockRejectedValue(new Error('Image recognition failed'));
      vi.mocked(queryKnowledgeBase).mockResolvedValue(mockKnowledgeResult);

      const context: ToolContext = {
        ...mockContext,
        imageUrls: ['https://example.com/image.jpg'],
      };

      const result = await orchestrateTools(context);

      expect(result.success).toBe(true);
      expect(result.data?.imageDescription).toBeUndefined();
      expect(result.data?.knowledgeBase).toBeTruthy();
      expect(result.toolsUsed).toContain('image_recognition');
      expect(result.toolsUsed).toContain('knowledge_base');
      
      // 验证知识库查询仍然被调用
      expect(queryKnowledgeBase).toHaveBeenCalled();
    });

    it('should handle timeout for image recognition', async () => {
      const mockKnowledgeResult = {
        hasResults: true,
        documents: [
          {
            documentId: 'doc-1',
            output: '知识库结果',
          },
        ],
        source: 'knowledge_base' as const,
      };

      // Mock 一个超时的图片识别（延迟超过超时时间 10s，设置为 12s）
      vi.mocked(recognizeImage).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ description: 'timeout' }), 12000))
      );
      vi.mocked(queryKnowledgeBase).mockResolvedValue(mockKnowledgeResult);

      const context: ToolContext = {
        ...mockContext,
        imageUrls: ['https://example.com/image.jpg'],
      };

      const result = await orchestrateTools(context);

      expect(result.success).toBe(true);
      expect(result.data?.knowledgeBase).toBeTruthy();
      // 图片识别应该超时，但不影响后续流程
    }, 15000); // 设置测试超时为 15 秒
  });
});
