import React, { useEffect, useState } from 'react';
import { Loader2, CheckCircle, XCircle, Image as ImageIcon, Database, Search } from 'lucide-react';
import { ToolCall } from '../../machines/chatMachine';

interface ToolCallCardProps {
  tools: ToolCall[];
}

const toolConfig: Record<string, { label: string; icon: React.ReactNode }> = {
  'image_recognition': {
    label: '识别图片',
    icon: <ImageIcon className="w-4 h-4" />,
  },
  'knowledge_base': {
    label: '查询知识库',
    icon: <Database className="w-4 h-4" />,
  },
  'web_search': {
    label: '网络搜索',
    icon: <Search className="w-4 h-4" />,
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
      className={`flex items-center gap-2 bg-slate-100/80 dark:bg-slate-800/80 backdrop-blur-sm px-3 py-2 rounded-lg text-sm border border-slate-200/50 dark:border-slate-700/50 transition-all duration-300 ${
        isVisible
          ? 'opacity-100 translate-y-0'
          : 'opacity-0 translate-y-2'
      }`}
    >
      <div className="text-slate-600 dark:text-slate-400">
        {toolInfo.icon}
      </div>

      <span className="text-slate-700 dark:text-slate-300 font-medium">
        {toolInfo.label}
      </span>

      <div className="flex items-center gap-1.5 ml-auto">
        {tool.status === 'pending' && (
          <span className="text-xs text-slate-500">等待中</span>
        )}

        {tool.status === 'running' && (
          <>
            <span className="text-xs text-blue-600 dark:text-blue-400">进行中</span>
            <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
          </>
        )}

        {tool.status === 'completed' && (
          <>
            <span className="text-xs text-green-600 dark:text-green-400">完成</span>
            <CheckCircle className="w-4 h-4 text-green-500" />
            {tool.duration && (
              <span className="text-xs text-slate-500 ml-1">
                {formatDuration(tool.duration)}
              </span>
            )}
          </>
        )}

        {tool.status === 'failed' && (
          <>
            <span className="text-xs text-red-600 dark:text-red-400">失败</span>
            <XCircle className="w-4 h-4 text-red-500" />
          </>
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
    <div className="flex flex-col gap-2 mb-3 px-1">
      {tools.map((tool, index) => (
        <ToolCallItem key={tool.id} tool={tool} index={index} />
      ))}
    </div>
  );
};
