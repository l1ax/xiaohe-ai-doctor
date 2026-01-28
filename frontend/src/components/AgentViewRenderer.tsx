import React, { useMemo, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { AgentView } from '../models/AgentView';
import { EventRenderer, ToolCallRenderer, ThinkingRenderer } from './EventRenderer';
import { ThinkingEvent } from '../models/events/ThinkingEvent';
import { ToolCallEvent } from '../models/events/ToolCallEvent';
import { ChevronDown, Loader2, Sparkles, AlertCircle } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

interface AgentViewRendererProps {
  view: AgentView;
}

/**
 * Agent 视图渲染器：聚合渲染 AgentView 中的所有事件
 */
export const AgentViewRenderer: React.FC<AgentViewRendererProps> = observer(({ view }) => {
  // 1. 将事件分组：思考 -> 工具组(s) -> 内容 -> 错误
  const groups = useMemo(() => {
    const grouped: Array<{ type: 'thinking' | 'tool_group' | 'content' | 'error'; events: any[] }> = [];
    let currentToolGroup: ToolCallEvent[] = [];

    view.events.forEach((event) => {
      // 如果不是工具调用，且有累积的工具组，先推送工具组
      if (event.type !== 'tool_call' && currentToolGroup.length > 0) {
        grouped.push({ type: 'tool_group', events: [...currentToolGroup] });
        currentToolGroup = [];
      }

      if (event.type === 'tool_call') {
        currentToolGroup.push(event as ToolCallEvent);
      } else if (event.type === 'thinking') {
        grouped.push({ type: 'thinking', events: [event] });
      } else if (event.type === 'message_content') {
        // 合并多个 message_content（虽然目前的逻辑通常只有一个流式的）
        const lastGroup = grouped[grouped.length - 1];
        if (lastGroup?.type === 'content') {
          lastGroup.events.push(event);
        } else {
          grouped.push({ type: 'content', events: [event] });
        }
      } else if (event.type === 'error') {
        grouped.push({ type: 'error', events: [event] });
      } else {
         // 其他类型直接渲染（比如状态），暂不特殊处理或者单独成组
         // 目前 EventRenderer 处理了 conversation_status，这里可以保留
         grouped.push({ type:  'error', events: [event] }); // Fallback treatment for now if needed, or ignore
      }
    });

    // 处理结尾残留的工具组
    if (currentToolGroup.length > 0) {
      grouped.push({ type: 'tool_group', events: [...currentToolGroup] });
    }

    return grouped;
  }, [view.events, view.events.length]); // depend on length to trigger re-calc on updates
  
  // 3. 渲染
  return (
    <div className="flex flex-col gap-2 w-full">
      {groups.map((group, groupIndex) => {
        if (group.type === 'thinking') {
          return group.events.map(e => <ThinkingRenderer key={e.id} event={e as ThinkingEvent} />);
        }

        if (group.type === 'tool_group') {
           return <ToolGroup key={`group-${groupIndex}`} events={group.events as ToolCallEvent[]} />;
        }

        if (group.type === 'content') {
           return group.events.map(e => <EventRenderer key={e.id} event={e} />); 
        }

        if (group.type === 'error') {
           return group.events.map(e => <EventRenderer key={e.id} event={e} />);
        }
        
        return null;
      })}
    </div>
  );
});

/**
 * 工具组组件：折叠显示的工具调用列表
 */
const ToolGroup: React.FC<{ events: ToolCallEvent[] }> = observer(({ events }) => {
  // 默认展开条件：有正在运行的工具，或者有失败的工具
  const hasRunning = events.some(e => e.status === 'running');
  const hasFailed = events.some(e => e.status === 'failed');
  const isOpenDefault = hasRunning; 
  
  const [isOpen, setIsOpen] = useState(isOpenDefault);

  // 状态显示逻辑
  const runningCount = events.filter(e => e.status === 'running').length;
  const failedCount = events.filter(e => e.status === 'failed').length;
  const completedCount = events.filter(e => e.status === 'completed').length;
  const totalCount = events.length;

  let summaryText = '';
  let statusColor = 'text-muted-foreground';
  let Icon = Sparkles;

  if (hasRunning) {
    summaryText = `正在执行工具 (${runningCount}/${totalCount})...`;
    statusColor = 'text-blue-500';
    Icon = Loader2;
  } else if (hasFailed) {
    summaryText = `${failedCount} 个工具执行失败`;
    statusColor = 'text-red-500';
    Icon = AlertCircle;
  } else {
    summaryText = `已完成 ${completedCount} 个工具调用`;
    statusColor = 'text-green-600';
    Icon = Sparkles;
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="w-full mb-2">
      <div className="flex items-center gap-2">
         <CollapsibleTrigger asChild>
            <button className={cn(
               "flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-full transition-all border shadow-sm hover:shadow-md bg-white dark:bg-slate-800",
               statusColor
            )}>
               <Icon className={cn("w-3.5 h-3.5", hasRunning && "animate-spin")} />
               <span>{summaryText}</span>
               <ChevronDown className={cn("w-3 h-3 transition-transform duration-200 opacity-50", isOpen && "rotate-180")} />
            </button>
         </CollapsibleTrigger>
      </div>

      <CollapsibleContent className="mt-2 pl-4 border-l-2 border-primary/10 ml-4 space-y-2 animate-in slide-in-from-top-2 fade-in duration-200">
         {events.map((event) => (
            <ToolCallRenderer key={event.id} event={event} />
         ))}
      </CollapsibleContent>
    </Collapsible>
  );
});
