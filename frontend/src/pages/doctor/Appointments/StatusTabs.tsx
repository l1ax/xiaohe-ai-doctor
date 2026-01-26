import type { AppointmentStatus, StatusTab } from './types';

interface StatusTabsProps {
  activeTab: AppointmentStatus | 'all';
  onTabChange: (tab: AppointmentStatus | 'all') => void;
  counts?: Record<AppointmentStatus | 'all', number>;
}

const statusTabs: StatusTab[] = [
  { key: 'all', label: '全部' },
  { key: 'pending', label: '待确认' },
  { key: 'confirmed', label: '已确认' },
  { key: 'cancelled', label: '已取消' },
  { key: 'completed', label: '已完成' },
];

export const StatusTabs = ({ activeTab, onTabChange, counts }: StatusTabsProps) => {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
      {statusTabs.map((tab) => {
        const isActive = activeTab === tab.key;
        const count = counts?.[tab.key];

        return (
          <button
            key={tab.key}
            onClick={() => onTabChange(tab.key)}
            className={`
              flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200
              ${isActive
                ? 'bg-primary text-white shadow-md shadow-primary/30'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
              }
            `}
          >
            <span className="flex items-center gap-2">
              {tab.label}
              {typeof count === 'number' && (
                <span className={`
                  px-1.5 py-0.5 rounded-full text-xs font-bold
                  ${isActive
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                  }
                `}>
                  {count}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
};
