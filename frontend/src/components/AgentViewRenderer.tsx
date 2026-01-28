import React, { useState, useEffect } from 'react';
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
  isComplete?: boolean;
}

/**
 * Agent 视图渲染器：聚合渲染 AgentView 中的所有事件
 * 分组逻辑已移至数据层 (AgentView.groups)
 */
export const AgentViewRenderer: React.FC<AgentViewRendererProps> = observer(({ view, isComplete = false }) => {
  // 直接使用数据层的分组计算结果
  return (
    <div className="flex flex-col gap-2 w-full">
      {view.groups.map((group, groupIndex) => {
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

      {!isComplete && (
        <div className="flex items-center gap-1.5 ml-1 mt-1">
          <div className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce [animation-delay:-0.3s]" />
          <div className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce [animation-delay:-0.15s]" />
          <div className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce" />
        </div>
      )}
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
  
  const [isOpen, setIsOpen] = useState(hasRunning);

  // 当有工具正在运行时自动展开
  useEffect(() => {
    if (hasRunning) {
      setIsOpen(true);
    }
  }, [hasRunning]);

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
