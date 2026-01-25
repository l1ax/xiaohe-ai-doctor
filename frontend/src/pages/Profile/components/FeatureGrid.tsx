import { observer } from 'mobx-react-lite';
import { useNavigate } from 'react-router-dom';

interface FeatureItem {
  icon: string;
  label: string;
  path: string;
  hasBadge?: boolean;
}

const features: FeatureItem[] = [
  { icon: 'calendar_month', label: '我的预约', path: '/appointments' },
  { icon: 'clinical_notes', label: '问诊记录', path: '/consultations', hasBadge: true },
  { icon: 'receipt_long', label: '电子处方', path: '/prescriptions' },
  { icon: 'folder_shared', label: '健康档案', path: '/health-records' },
];

const FeatureGrid = observer(function FeatureGrid() {
  const navigate = useNavigate();

  return (
    <section className="relative px-4 -mt-12 z-20">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-soft border border-slate-100/50 dark:border-slate-700/50 p-5">
        <div className="grid grid-cols-4 gap-2">
          {features.map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className="flex flex-col items-center gap-3 group w-full"
            >
              <div className="relative w-12 h-12 bg-blue-50 dark:bg-blue-500/10 rounded-2xl flex items-center justify-center text-primary transition-all duration-300 group-hover:bg-primary group-hover:text-white group-active:scale-95 shadow-sm group-hover:shadow-md">
                <span className="material-symbols-outlined text-[26px]">{item.icon}</span>
                {item.hasBadge && (
                  <span className="absolute top-0 right-0 -mt-1 -mr-1 w-3 h-3 bg-red-500 border-2 border-white dark:border-slate-800 rounded-full"></span>
                )}
              </div>
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 group-hover:text-primary transition-colors text-center leading-tight">
                {item.label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
});

export default FeatureGrid;
