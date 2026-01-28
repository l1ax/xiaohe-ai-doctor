import React from 'react';
import { observer } from 'mobx-react-lite';
import { Conversation } from '../models/Conversation';
import { ConversationItemRenderer } from './ConversationItemRenderer';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertCircle } from "lucide-react";

interface ConversationRendererProps {
  conversation: Conversation;
}

/**
 * 对话渲染器：渲染整个对话，包括所有用户消息和 Agent 响应
 */
export const ConversationRenderer: React.FC<ConversationRendererProps> = observer(({ conversation }) => {
  return (
    <div className="flex flex-col gap-4">
      {conversation.items.map((item) => (
        <ConversationItemRenderer key={item.id} item={item} />
      ))}

      {conversation.status === 'connecting' && (
        <div className="flex justify-center py-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>连接中...</span>
          </div>
        </div>
      )}

      {conversation.error && (
        <Alert variant="destructive" className="my-2">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {conversation.error.message}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
});
