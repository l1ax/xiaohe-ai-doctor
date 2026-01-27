import React from 'react';
import { observer } from 'mobx-react-lite';
import { ConversationItem } from '../models/ConversationItem';
import { UserMessage } from '../models/UserMessage';
import { AgentResponse } from '../models/AgentResponse';
import { AgentViewRenderer } from './AgentViewRenderer';

interface ConversationItemRendererProps {
  item: ConversationItem;
}

/**
 * 对话项渲染器：根据角色渲染用户消息或 Agent 响应
 */
export const ConversationItemRenderer: React.FC<ConversationItemRendererProps> = observer(({ item }) => {
  if (item.role === 'user') {
    return <UserMessageRenderer message={item as UserMessage} />;
  } else {
    return <AgentResponseRenderer response={item as AgentResponse} />;
  }
});

/**
 * 用户消息渲染器
 */
const UserMessageRenderer: React.FC<{ message: UserMessage }> = observer(({ message }) => {
  return (
    <div className="conversation-item user-message">
      <div className="message-avatar">👤</div>
      <div className="message-content">
        <div className="message-text">{message.content}</div>
        {message.attachments && message.attachments.length > 0 && (
          <div className="message-attachments">
            {message.attachments.map((attachment, index) => (
              <div key={index} className="attachment">
                {attachment.type === 'image' ? (
                  <img src={attachment.url} alt={attachment.name} className="attachment-image" />
                ) : (
                  <a href={attachment.url} target="_blank" rel="noopener noreferrer">
                    {attachment.name}
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

/**
 * Agent 响应渲染器
 */
const AgentResponseRenderer: React.FC<{ response: AgentResponse }> = observer(({ response }) => {
  return (
    <div className="conversation-item agent-response">
      <div className="message-avatar">🤖</div>
      <div className="message-content">
        <AgentViewRenderer view={response.view} />
        {response.isComplete && <div className="message-complete-indicator">✓</div>}
      </div>
    </div>
  );
});
