import { useNavigate } from 'react-router-dom';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FeatureCardProps {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  to: string;
  className?: string;
  gradientFrom?: string;
  gradientTo?: string;
  color?: string;
}

export default function FeatureCard({
  title,
  subtitle,
  icon: Icon,
  to,
  className = '',
  gradientFrom,
  gradientTo,
  color = 'gray',
}: FeatureCardProps) {
  const navigate = useNavigate();

  const colorClasses: Record<string, { bg: string; icon: string; iconBg: string }> = {
    teal: { bg: 'bg-white dark:bg-surface-dark', icon: 'text-teal-600 dark:text-teal-400', iconBg: 'bg-teal-50 dark:bg-teal-900/30' },
    indigo: { bg: 'bg-white dark:bg-surface-dark', icon: 'text-indigo-600 dark:text-indigo-400', iconBg: 'bg-indigo-50 dark:bg-indigo-900/30' },
  };

  const colors = colorClasses[color] || { bg: '', icon: '', iconBg: '' };

  if (gradientFrom) {
    return (
      <div
        onClick={() => navigate(to)}
        className={cn(
          `relative overflow-hidden rounded-2xl bg-gradient-to-br from-${gradientFrom} to-${gradientTo} shadow-lg shadow-${gradientFrom}/20 group cursor-pointer active:scale-[0.98] transition-all`,
          className
        )}
      >
        <div className="absolute top-0 right-0 p-8 bg-white/10 rounded-full blur-2xl -mr-6 -mt-6"></div>
        <div className="absolute bottom-0 left-0 p-10 bg-black/5 rounded-full blur-xl -ml-4 -mb-4"></div>
        <div className="relative z-10 h-full flex flex-col justify-between p-4">
          <div>
            <div className="bg-white/20 w-10 h-10 rounded-full flex items-center justify-center mb-3 backdrop-blur-sm">
              <Icon className="text-white w-6 h-6" />
            </div>
            <h3 className="text-white text-lg font-bold leading-tight">{title}</h3>
            <p className="text-blue-50 text-xs mt-1 font-medium opacity-90">{subtitle}</p>
          </div>
          <div className="flex justify-end opacity-40 group-hover:scale-110 transition-transform duration-500">
            {/* Decorative background icon could be same or generic */}
             <Icon className="text-white w-16 h-16 opacity-20" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={() => navigate(to)}
      className={cn(
        `relative overflow-hidden rounded-2xl ${colors.bg} p-4 shadow-sm border border-gray-100 dark:border-gray-800 cursor-pointer active:scale-[0.98] transition-all group`,
        className
      )}
    >
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-text-main-light dark:text-text-main-dark text-base font-bold">{title}</h3>
          <p className="text-text-sec-light dark:text-text-sec-dark text-xs mt-1">{subtitle}</p>
        </div>
        <div className={cn(colors.iconBg, "w-8 h-8 rounded-full flex items-center justify-center")}>
          <Icon className={cn(colors.icon, "w-5 h-5")} />
        </div>
      </div>
      <div className="absolute -bottom-2 -right-2 opacity-5 dark:opacity-10 pointer-events-none">
        <Icon className={cn(color === 'teal' ? 'text-teal-900' : 'text-indigo-900', "w-16 h-16")} />
      </div>
    </div>
  );
}
