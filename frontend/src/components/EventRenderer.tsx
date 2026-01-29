import React, { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { MarkdownRenderer } from './shared/MarkdownRenderer';
import { 
  ChevronDown, 
  Terminal, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  Loader2
} from 'lucide-react';
import { Event } from '../models/events/Event';
import { ToolCallEvent } from '../models/events/ToolCallEvent';
import { MessageContentEvent } from '../models/events/MessageContentEvent';
import { ThinkingEvent } from '../models/events/ThinkingEvent';
import { ErrorEvent } from '../models/events/ErrorEvent';
import { ConversationStatusEvent } from '../models/events/ConversationStatusEvent';
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface EventRendererProps {
  event: Event;
}

/**
 * 事件渲染器：根据事件类型渲染不同的 UI
 */
export const EventRenderer: React.FC<EventRendererProps> = observer(({ event }) => {
  switch (event.type) {
    case 'tool_call':
      return <ToolCallRenderer event={event as ToolCallEvent} />;
    case 'message_content':
      return <MessageContentRenderer event={event as MessageContentEvent} />;
    case 'thinking':
      return <ThinkingRenderer event={event as ThinkingEvent} />;
    case 'error':
      return <ErrorRenderer event={event as ErrorEvent} />;
    case 'conversation_status':
      return <ConversationStatusRenderer event={event as ConversationStatusEvent} />;
    default:
      return null;
  }
});

/**
 * 工具调用渲染器
 */
export const ToolCallRenderer: React.FC<{ event: ToolCallEvent }> = observer(({ event }) => {
  const [isOpen, setIsOpen] = useState(false);

  const statusIcon = {
    running: <Loader2 className="w-4 h-4 animate-spin text-blue-500" />,
    completed: <CheckCircle2 className="w-4 h-4 text-green-500" />,
    failed: <XCircle className="w-4 h-4 text-red-500" />,
  };

  const statusText = {
    running: '执行中',
    completed: '执行成功',
    failed: '请求失败',
  };

  const hasOutput = event.output !== undefined;

  return (
    <Card className="mb-3 border-none bg-muted/30 shadow-none">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div className="flex items-center gap-2 p-3 text-sm">
          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-background border shadow-sm text-primary">
            {statusIcon[event.status]}
          </div>
          
          <span className="font-medium text-foreground flex-1">
            使用工具: {event.name}
          </span>
          
          <Badge variant="outline" className="bg-background/50 font-normal">
            {statusText[event.status]}
          </Badge>
          
          {hasOutput && (
            <CollapsibleTrigger asChild>
              <button className="p-1 hover:bg-background rounded-md transition-colors">
                <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform duration-200", isOpen && "rotate-180")} />
              </button>
            </CollapsibleTrigger>
          )}
        </div>

        <CollapsibleContent>
          <div className="px-3 pb-3 pt-0">
             <div className="bg-background rounded-md border p-3 text-xs font-mono overflow-auto max-h-[200px]">
                <div className="flex items-center gap-2 mb-2 text-muted-foreground border-b pb-2">
                  <Terminal className="w-3 h-3" />
                  <span>工具输出内容</span>
                </div>
                <pre className="whitespace-pre-wrap break-all text-foreground/80">
                  {typeof event.output === 'object' 
                    ? JSON.stringify(event.output, null, 2) 
                    : String(event.output)}
                </pre>
                {event.status === 'failed' && event.output?.error && (
                  <div className="mt-2 text-destructive bg-destructive/10 p-2 rounded border border-destructive/20">
                    <AlertCircle className="w-3 h-3 inline mr-1" />
                    {String(event.output.error)}
                  </div>
                )}
             </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
});

/**
 * 消息内容渲染器
 */
const MessageContentRenderer: React.FC<{ event: MessageContentEvent }> = observer(({ event }) => {
  if (!event.content) return null;

  return (
    <div className="prose prose-sm max-w-none dark:prose-invert leading-relaxed mb-4">
      <MarkdownRenderer content={event.content} />
      {!event.isComplete && <span className="inline-block w-2 h-4 bg-primary/50 ml-1 animate-pulse rounded-sm align-middle" />}
    </div>
  );
});

/**
 * 思考状态渲染器
 */
export const ThinkingRenderer: React.FC<{ event: ThinkingEvent }> = observer(() => {
  return (
    <div className="flex items-center gap-3 p-4 bg-muted/20 rounded-lg mb-4">
      <div className="flex space-x-1">
        <Skeleton className="h-2 w-2 rounded-full bg-primary/40 animate-bounce [animation-delay:-0.3s]" />
        <Skeleton className="h-2 w-2 rounded-full bg-primary/40 animate-bounce [animation-delay:-0.15s]" />
        <Skeleton className="h-2 w-2 rounded-full bg-primary/40 animate-bounce" />
      </div>
      <span className="text-sm text-muted-foreground italic">小荷正在思考为您提供最准确的建议...</span>
    </div>
  );
});

/**
 * 错误渲染器
 */
const ErrorRenderer: React.FC<{ event: ErrorEvent }> = observer(({ event }) => {
  return (
    <Alert variant="destructive" className="mb-4 bg-destructive/5 border-destructive/20">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>出错啦</AlertTitle>
      <AlertDescription className="mt-1 flex flex-col gap-1">
        <span>{event.message}</span>
        {event.code && <span className="text-xs opacity-70 font-mono">CODE: {event.code}</span>}
      </AlertDescription>
    </Alert>
  );
});

/**
 * 对话状态渲染器
 */
const ConversationStatusRenderer: React.FC<{ event: ConversationStatusEvent }> = observer(({ event }) => {
  if (['idle', 'processing', 'streaming', 'complete', 'starting'].includes(event.status)) {
    return null;
  }

  return (
    <div className="flex justify-center my-4">
      <Badge variant="outline" className="text-xs text-muted-foreground font-normal border-dashed">
        {event.message || event.status}
      </Badge>
    </div>
  );
});
