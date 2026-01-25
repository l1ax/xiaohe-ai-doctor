import { getDepartmentColor } from '../../../mock/data';

interface DepartmentItemProps {
  department: {
    id: string;
    name: string;
    icon: string;
    color: string;
  };
}

export default function DepartmentItem({ department }: DepartmentItemProps) {
  const colors = getDepartmentColor(department.color);

  return (
    <div className="flex flex-col items-center gap-2 cursor-pointer group">
      <div
        className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${
          department.color === 'slate'
            ? 'bg-slate-100 dark:bg-surface-dark group-hover:bg-slate-200 dark:group-hover:bg-slate-800'
            : `${colors.bg} group-hover:bg-primary/10`
        }`}
      >
        <span className={`material-symbols-outlined ${department.color === 'slate' ? 'text-slate-500' : colors.text} text-[24px]`}>
          {department.icon}
        </span>
      </div>
      <span className="text-xs font-medium text-text-main-light dark:text-text-sec-dark">{department.name}</span>
    </div>
  );
}
