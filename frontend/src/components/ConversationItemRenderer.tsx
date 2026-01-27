import React from 'react';
import { observer } from 'mobx-react-lite';
import { User, Bot } from 'lucide-react';
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
      <div className="message-content">
        <div className="message-text">{message.content}</div>
        {message.attachments && message.attachments.length > 0 && (
          <div className="message-attachments">
            {message.attachments.map((attachment, index) => (
              <div key={index} className="attachment">
                {attachment.type === 'image' ? (
                  <img src={attachment.url} alt={attachment.name} className="attachment-image shadow-sm" />
                ) : (
                  <a href={attachment.url} target="_blank" rel="noopener noreferrer" className="text-white underline text-sm opacity-90">
                    {attachment.name}
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="message-avatar bg-primary text-white shadow-sm">
        <User className="w-5 h-5" />
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
      <div className="message-avatar bg-white dark:bg-slate-700 border-2 border-primary/20 shadow-sm overflow-hidden">
        <img
          src="https://lh3.googleusercontent.com/aida-public/AB6AXuCF1kVXFyF37q3nrI02oGmsRVTY32V4_XBRDIbhjwotETvXN2SYYSvbHK1-QKsrjtU3IFzODgzEz4wCNcZ88VrNw4gmwGKNwCz7ULW1EeppZuX5FWqZrkxsDvxodVjnkMQKZAi8QaQP7iu1oG_T8cwbWYvfQ7tCJ8HAXLP_3fvgB_ZCpCkbJ8yIW0s1Q8bv2Poeg0A98RIJXErD3OLPQFuV3-hOijxEtf-DN9zpxVPf1vwMMmBEB26_cgxXZZrMFn-6hwZfpzNkHMc-"
          alt="AI Doctor"
          className="w-full h-full object-cover"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
        <Bot className="w-5 h-5 text-primary" />
      </div>
      <div className="message-content">
        <AgentViewRenderer view={response.view} />
      </div>
    </div>
  );
});
