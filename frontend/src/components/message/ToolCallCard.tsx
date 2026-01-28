import React, { useEffect, useState } from 'react';
import { Loader2, CheckCircle, XCircle, Image as ImageIcon, Database, Search } from 'lucide-react';
import { ToolCall } from '../../machines/chatMachine';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ToolCallCardProps {
  tools: ToolCall[];
}

const toolConfig: Record<string, { label: string; icon: React.ReactNode }> = {
  'image_recognition': {
    label: '识别图片',
    icon: <ImageIcon className="w-3.5 h-3.5" />,
  },
  'knowledge_base': {
    label: '查询知识库',
    icon: <Database className="w-3.5 h-3.5" />,
  },
  'web_search': {
    label: '网络搜索',
    icon: <Search className="w-3.5 h-3.5" />,
  },
};

const getToolInfo = (name: string) => {
  return toolConfig[name] || { label: name, icon: null };
};

const formatDuration = (ms?: number): string => {
  if (!ms) return '';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
};

// 单个工具调用项组件（带动画）
const ToolCallItem: React.FC<{ tool: ToolCall; index: number }> = ({ tool, index }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // 延迟显示，创建逐个出现的动画效果
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, index * 150); // 每个工具延迟 150ms

    return () => clearTimeout(timer);
  }, [index]);

  const toolInfo = getToolInfo(tool.name);

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-all duration-300 border",
        "bg-slate-100/50 dark:bg-slate-800/50 border-transparent hover:border-border",
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
      )}
    >
      <div className="text-muted-foreground flex items-center justify-center w-5 h-5 bg-background rounded-full shadow-sm">
        {toolInfo.icon}
      </div>

      <span className="text-foreground font-medium text-xs">
        {toolInfo.label}
      </span>

      <div className="flex items-center gap-1.5 ml-auto">
        {tool.status === 'pending' && (
          <Badge variant="outline" className="text-[10px] h-5 px-1.5 text-muted-foreground font-normal">等待中</Badge>
        )}

        {tool.status === 'running' && (
          <Badge variant="secondary" className="text-[10px] h-5 px-1.5 gap-1 font-normal bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400 hover:bg-blue-50">
            <span>进行中</span>
            <Loader2 className="w-3 h-3 animate-spin" />
          </Badge>
        )}

        {tool.status === 'completed' && (
          <div className="flex items-center gap-1.5">
             <Badge variant="outline" className="text-[10px] h-5 px-1.5 gap-1 font-normal border-green-200 text-green-600 dark:border-green-900 dark:text-green-400 bg-green-50/50 dark:bg-green-950/30">
              <span>完成</span>
              <CheckCircle className="w-3 h-3" />
            </Badge>
            {tool.duration && (
              <span className="text-[10px] text-muted-foreground">
                {formatDuration(tool.duration)}
              </span>
            )}
          </div>
        )}

        {tool.status === 'failed' && (
           <Badge variant="destructive" className="text-[10px] h-5 px-1.5 gap-1 font-normal">
            <span>失败</span>
            <XCircle className="w-3 h-3" />
          </Badge>
        )}
      </div>
    </div>
  );
};

export const ToolCallCard: React.FC<ToolCallCardProps> = ({ tools }) => {
  if (!tools || tools.length === 0) {
    return null;
  }

  return (
    <Card className="border-none shadow-none bg-transparent p-0">
      <div className="flex flex-col gap-1.5 mb-2">
        {tools.map((tool, index) => (
          <ToolCallItem key={tool.id} tool={tool} index={index} />
        ))}
      </div>
    </Card>
  );
};
