interface EmptyStateProps {
  status?: string;
}

export const EmptyState = ({ status }: EmptyStateProps) => {
  const getStatusText = () => {
    switch (status) {
      case 'pending':
        return '暂无需确认的预约';
      case 'confirmed':
        return '暂无已确认的预约';
      case 'cancelled':
        return '暂无已取消的预约';
      case 'completed':
        return '暂无已完成的预约';
      default:
        return '暂无预约记录';
    }
  };

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      {/* 图标 */}
      <div className="w-24 h-24 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-6">
        <span className="material-symbols-outlined text-5xl text-slate-300 dark:text-slate-600">
          event_available
        </span>
      </div>

      {/* 文字提示 */}
      <p className="text-base font-medium text-slate-600 dark:text-slate-400 mb-2">
        {getStatusText()}
      </p>

      {/* 副标题 */}
      {status === 'all' && (
        <p className="text-sm text-slate-400 dark:text-slate-500">
          当有新的预约时，会在这里显示
        </p>
      )}
    </div>
  );
};
