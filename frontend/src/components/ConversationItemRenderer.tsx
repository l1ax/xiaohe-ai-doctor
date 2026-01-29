import React from 'react';
import { observer } from 'mobx-react-lite';
import { User, Bot } from 'lucide-react';
import { ConversationItem } from '../models/ConversationItem';
import { UserMessage } from '../models/UserMessage';
import { AgentResponse } from '../models/AgentResponse';
import { AgentViewRenderer } from './AgentViewRenderer';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

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
    <div className="flex justify-end items-start gap-3 mb-6">
      <div className="flex flex-col gap-1 items-end max-w-[85%]">
        <div className="bg-primary text-primary-foreground rounded-2xl rounded-tr-none px-4 py-3 shadow-md text-[16px] leading-relaxed">
          <div className="whitespace-pre-wrap">{message.content}</div>
        </div>
        
        {message.attachments && message.attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 justify-end mt-1">
            {message.attachments.map((attachment, index) => (
              <div key={index} className="relative group">
                {attachment.type === 'image' ? (
                  <img src={attachment.url} alt={attachment.name} className="h-24 w-auto rounded-lg shadow-sm border" />
                ) : (
                  <a href={attachment.url} target="_blank" rel="noopener noreferrer" className="text-xs bg-muted px-2 py-1 rounded-full flex items-center gap-1 hover:bg-muted/80">
                    <span className="truncate max-w-[100px]">{attachment.name}</span>
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      
      <Avatar className="w-10 h-10 border-2 border-background shadow-sm">
        <AvatarFallback className="bg-primary/10 text-primary">
          <User className="w-5 h-5" />
        </AvatarFallback>
      </Avatar>
    </div>
  );
});

/**
 * Agent 响应渲染器
 */
const AgentResponseRenderer: React.FC<{ response: AgentResponse }> = observer(({ response }) => {
  return (
    <div className="flex justify-start items-start gap-3 mb-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <Avatar className="w-10 h-10 border-2 border-background shadow-sm mt-1 shrink-0">
        <AvatarImage 
          src="https://lh3.googleusercontent.com/aida-public/AB6AXuCF1kVXFyF37q3nrI02oGmsRVTY32V4_XBRDIbhjwotETvXN2SYYSvbHK1-QKsrjtU3IFzODgzEz4wCNcZ88VrNw4gmwGKNwCz7ULW1EeppZuX5FWqZrkxsDvxodVjnkMQKZAi8QaQP7iu1oG_T8cwbWYvfQ7tCJ8HAXLP_3fvgB_ZCpCkbJ8yIW0s1Q8bv2Poeg0A98RIJXErD3OLPQFuV3-hOijxEtf-DN9zpxVPf1vwMMmBEB26_cgxXZZrMFn-6hwZfpzNkHMc-" 
          alt="AI Doctor" 
        />
        <AvatarFallback className="bg-primary/5 text-primary">
          <Bot className="w-6 h-6" />
        </AvatarFallback>
      </Avatar>

      <div className="flex flex-col gap-1 items-start max-w-[95%] w-full min-w-0">
        <span className="text-muted-foreground text-xs font-medium ml-1">小荷AI医生</span>
        <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl rounded-tl-none px-4 py-3 shadow-sm text-sm w-full">
          <AgentViewRenderer view={response.view} isComplete={response.isComplete} />
        </div>
      </div>
    </div>
  );
});
