import React from 'react';
import { observer } from 'mobx-react-lite';
import { Conversation } from '../models/Conversation';
import { ConversationItemRenderer } from './ConversationItemRenderer';

interface ConversationRendererProps {
  conversation: Conversation;
}

/**
 * 对话渲染器：渲染整个对话，包括所有用户消息和 Agent 响应
 */
export const ConversationRenderer: React.FC<ConversationRendererProps> = observer(({ conversation }) => {
  return (
    <div className="conversation">
      {conversation.items.map((item) => (
        <ConversationItemRenderer key={item.id} item={item} />
      ))}

      {conversation.status === 'connecting' && (
        <div className="conversation-status connecting">
          <span className="status-icon">⏳</span>
          <span className="status-text">连接中...</span>
        </div>
      )}

      {conversation.error && (
        <div className="conversation-error">
          <span className="error-icon">❌</span>
          <span className="error-message">{conversation.error.message}</span>
        </div>
      )}
    </div>
  );
});
