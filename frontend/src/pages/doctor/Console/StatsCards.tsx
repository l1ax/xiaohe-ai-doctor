import { observer } from 'mobx-react-lite';
import { doctorStore } from '../../../store/doctorStore';

export const StatsCards = observer(() => {
  const { stats } = doctorStore;

  const cards = [
    {
      title: '今日接诊',
      value: stats.today,
      unit: '人',
      icon: 'people',
      color: 'from-blue-500 to-blue-600',
      bgColor: 'bg-blue-50 dark:bg-blue-900/20',
      textColor: 'text-blue-600 dark:text-blue-400'
    },
    {
      title: '待处理',
      value: stats.pending,
      unit: '人',
      icon: 'schedule',
      color: 'from-amber-500 to-amber-600',
      bgColor: 'bg-amber-50 dark:bg-amber-900/20',
      textColor: 'text-amber-600 dark:text-amber-400'
    },
    {
      title: '今日收入',
      value: stats.income,
      unit: '元',
      icon: 'payments',
      color: 'from-emerald-500 to-emerald-600',
      bgColor: 'bg-emerald-50 dark:bg-emerald-900/20',
      textColor: 'text-emerald-600 dark:text-emerald-400'
    }
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {cards.map((card) => (
        <div
          key={card.title}
          className={`${card.bgColor} rounded-2xl p-4 shadow-sm`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-600 dark:text-slate-400">
              {card.title}
            </span>
            <span className="material-symbols-outlined text-xl text-slate-400">
              {card.icon}
            </span>
          </div>
          <div className={`flex items-baseline gap-1`}>
            <span className={`text-2xl font-bold ${card.textColor}`}>
              {card.value}
            </span>
            <span className="text-sm text-slate-500 dark:text-slate-400">
              {card.unit}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
});
