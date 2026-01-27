import React from 'react';

/**
 * 跳动的点动画组件 - 类似 ChatGPT 风格
 * 用于显示 AI 正在思考的状态
 */
export const ThinkingDots: React.FC = () => {
  return (
    <div className="flex items-center gap-1" role="status" aria-label="AI 正在思考">
      <span className="w-2 h-2 bg-slate-400 dark:bg-slate-500 rounded-full animate-thinking-dot animation-delay-0" />
      <span className="w-2 h-2 bg-slate-400 dark:bg-slate-500 rounded-full animate-thinking-dot animation-delay-150" />
      <span className="w-2 h-2 bg-slate-400 dark:bg-slate-500 rounded-full animate-thinking-dot animation-delay-300" />
    </div>
  );
};
