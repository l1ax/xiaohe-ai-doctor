import { makeObservable, observable, action, computed } from 'mobx';
import { ConversationItem } from './ConversationItem';
import { UserMessage } from './UserMessage';
import { AgentResponse } from './AgentResponse';
import { SSEClient, SSEConfig } from '../services/sseClient';
import { SSEEvent } from './events/EventFactory';

/**
 * 对话模型：管理整个对话的数据和状态
 */
export class Conversation {
  @observable conversationId: string;
  @observable items: ConversationItem[] = [];
  @observable status: 'idle' | 'connecting' | 'processing' | 'error' = 'idle';
  @observable error: { code: string; message: string } | null = null;

  private sseClient: SSEClient | null = null;
  private currentAgentResponse: AgentResponse | null = null;

  constructor(conversationId?: string) {
    makeObservable(this);
    this.conversationId = conversationId || `conv-${Date.now()}`;
  }

  /**
   * 获取最后一个对话项
   */
  @computed
  get lastItem(): ConversationItem | null {
    return this.items.length > 0 ? this.items[this.items.length - 1] : null;
  }

  /**
   * 是否正在处理中
   */
  @computed
  get isProcessing(): boolean {
    return this.status === 'connecting' || this.status === 'processing';
  }

  /**
   * 添加用户消息
   */
  @action
  addUserMessage(content: string, attachments?: Array<{ type: string; url: string; name: string }>): UserMessage {
    const message = new UserMessage({
      id: `user-${Date.now()}`,
      content,
      attachments,
    });
    this.items.push(message);
    return message;
  }

  /**
   * 创建 Agent 响应
   */
  @action
  private createAgentResponse(): AgentResponse {
    const response = new AgentResponse(`agent-${Date.now()}`);
    this.items.push(response);
    this.currentAgentResponse = response;
    return response;
  }

  /**
   * 发送消息并建立 SSE 连接
   */
  @action
  async sendMessage(content: string, imageUrls?: string[]): Promise<void> {
    // 添加用户消息
    this.addUserMessage(content, imageUrls?.map(url => ({ type: 'image', url, name: url })));

    // 创建 Agent 响应
    this.createAgentResponse();

    // 清除之前的错误
    this.error = null;
    this.status = 'connecting';

    try {
      // 关闭旧连接（如果存在）
      if (this.sseClient) {
        this.sseClient.close();
        this.sseClient = null;
      }

      // 创建新的 SSE 客户端
      const config: SSEConfig = {
        url: '/api/ai-chat/stream',
        method: 'POST',
        conversationId: this.conversationId,
        message: content,
        imageUrls,
        onEvent: (event) => this.handleSSEEvent(event as any),
        onError: (error) => this.handleSSEError(error),
        onClose: () => this.handleSSEClose(),
        onOpen: () => this.handleSSEOpen(),
      };

      this.sseClient = new SSEClient(config);
      await this.sseClient.connect();
    } catch (error) {
      this.handleSSEError(error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * 处理 SSE 事件
   */
  @action
  private handleSSEEvent(event: SSEEvent): void {
    console.log('[Conversation] Received SSE event:', event);

    if (!this.currentAgentResponse) {
      console.warn('[Conversation] No current agent response to handle event:', event);
      return;
    }

    // 对话结束事件
    if (event.type === 'conversation_end') {
      console.log('[Conversation] Conversation ended');
      this.currentAgentResponse.markComplete();
      this.status = 'idle';
      this.currentAgentResponse = null;
      return;
    }

    // 对话状态事件
    if (event.type === 'conversation_status') {
      const status = event.data.status;
      console.log('[Conversation] Status changed to:', status);
      if (status === 'processing' || status === 'streaming') {
        this.status = 'processing';
      } else if (status === 'complete') {
        this.status = 'idle';
      } else if (status === 'error') {
        this.status = 'error';
      }
    }

    // 路由到 AgentResponse 处理
    console.log('[Conversation] Routing to AgentView');
    this.currentAgentResponse.view.handleSSEEvent(event);
  }

  /**
   * 处理 SSE 错误
   */
  @action
  private handleSSEError(error: Error): void {
    console.error('[Conversation] SSE error:', error);
    this.status = 'error';
    this.error = {
      code: 'SSE_ERROR',
      message: error.message || '连接错误',
    };

    if (this.currentAgentResponse) {
      this.currentAgentResponse.markComplete();
      this.currentAgentResponse = null;
    }
  }

  /**
   * 处理 SSE 连接打开
   */
  @action
  private handleSSEOpen(): void {
    this.status = 'processing';
  }

  /**
   * 处理 SSE 连接关闭
   */
  @action
  private handleSSEClose(): void {
    if (this.currentAgentResponse && !this.currentAgentResponse.isComplete) {
      this.currentAgentResponse.markComplete();
      this.currentAgentResponse = null;
    }

    if (this.status !== 'error') {
      this.status = 'idle';
    }
  }

  /**
   * 关闭连接
   */
  @action
  close(): void {
    if (this.sseClient) {
      this.sseClient.close();
      this.sseClient = null;
    }

    if (this.currentAgentResponse) {
      this.currentAgentResponse.markComplete();
      this.currentAgentResponse = null;
    }

    this.status = 'idle';
  }

  /**
   * 清空对话
   */
  @action
  clear(): void {
    this.close();
    this.items = [];
    this.error = null;
  }

  /**
   * 从历史记录加载对话
   */
  @action
  async loadFromHistory(conversationId: string): Promise<void> {
    try {
      // Import userStore dynamically to avoid circular dependency
      const { userStore } = await import('../store/userStore');
      const token = userStore.accessToken;
      
      if (!token) {
        throw new Error('未登录');
      }

      const response = await fetch(`/api/ai-chat/conversations/${conversationId}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }

      const result = await response.json();

      if (result.code !== 'SUCCESS') {
        throw new Error(result.message || '加载对话失败');
      }

      // Update conversation ID
      this.conversationId = conversationId;
      
      // Clear existing items
      this.items = [];

      // Reconstruct messages from history
      const messages = result.data.messages || [];
      
      for (const msg of messages) {
        if (msg.senderId === 'assistant') {
          // Create agent response with content
          const agentResponse = new AgentResponse(`agent-${msg.id}`);
          // Add message content via SSE event simulation
          agentResponse.view.handleSSEEvent({
            type: 'message_content',
            data: {
              messageId: `msg-${msg.id}`,
              delta: msg.content,
              isLast: true,
            },
          });
          agentResponse.markComplete();
          this.items.push(agentResponse);
        } else {
          // Create user message
          const userMessage = new UserMessage({
            id: `user-${msg.id}`,
            content: msg.content,
            attachments: msg.metadata?.imageUrl 
              ? [{ type: 'image', url: msg.metadata.imageUrl, name: 'image' }]
              : undefined,
          });
          this.items.push(userMessage);
        }
      }

      console.log(`[Conversation] Loaded ${messages.length} messages from history`);
    } catch (error) {
      console.error('[Conversation] Failed to load from history:', error);
      this.error = {
        code: 'LOAD_ERROR',
        message: error instanceof Error ? error.message : '加载对话失败',
      };
      throw error;
    }
  }
}
