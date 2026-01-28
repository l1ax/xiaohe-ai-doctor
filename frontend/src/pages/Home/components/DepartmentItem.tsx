import { getDepartmentColor } from '../../../mock/data';
import { 
  Baby, 
  Heart, 
  Smile, 
  User, 
  Leaf, 
  Bone, 
  Baby as PregnantWoman, // Fallback/Proxy
  LayoutGrid,
  Activity // Fallback
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Icon mapping
const iconMap: Record<string, React.ElementType> = {
  child_care: Baby,
  cardiology: Heart,
  dentistry: Smile,
  face: User,
  spa: Leaf,
  orthopedics: Bone,
  pregnant_woman: PregnantWoman,
  grid_view: LayoutGrid,
};

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
  const Icon = iconMap[department.icon] || Activity;

  return (
    <div className="flex flex-col items-center gap-2 cursor-pointer group">
      <div
        className={cn(
          "w-12 h-12 rounded-xl flex items-center justify-center transition-colors",
          department.color === 'slate'
            ? 'bg-slate-100 dark:bg-surface-dark group-hover:bg-slate-200 dark:group-hover:bg-slate-800'
            : cn(colors.bg, "group-hover:bg-primary/10")
        )}
      >
        <Icon className={cn(
          "w-6 h-6",
          department.color === 'slate' ? 'text-slate-500' : colors.text
        )} />
      </div>
      <span className="text-xs font-medium text-text-main-light dark:text-text-sec-dark">{department.name}</span>
    </div>
  );
}
