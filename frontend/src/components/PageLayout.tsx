import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

interface PageLayoutProps {
  title: string;
  children: React.ReactNode;
  showBack?: boolean;
  rightAction?: React.ReactNode;
  headerClassName?: string;
}

/**
 * 通用页面布局组件
 * - Header 固定在顶部
 * - Content 区域可滚动
 */
export const PageLayout: React.FC<PageLayoutProps> = ({
  title,
  children,
  showBack = true,
  rightAction,
  headerClassName = '',
}) => {
  const navigate = useNavigate();

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Fixed Header */}
      <header className={`sticky top-0 z-10 flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-800 shadow-sm ${headerClassName}`}>
        <div className="flex items-center gap-3">
          {showBack && (
            <button
              onClick={() => navigate(-1)}
              className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 active:scale-95 transition-all"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}
          <h1 className="text-xl font-bold">{title}</h1>
        </div>
        {rightAction && <div>{rightAction}</div>}
      </header>

      {/* Scrollable Content */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
};

export default PageLayout;
