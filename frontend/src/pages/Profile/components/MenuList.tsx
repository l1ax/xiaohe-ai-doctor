import { observer } from 'mobx-react-lite';
import { useNavigate } from 'react-router-dom';

interface MenuItem {
  icon: string;
  label: string;
  path: string;
  description?: string;
  iconBgClass: string;
}

const menuItems: MenuItem[] = [
  { icon: 'diversity_3', label: '家庭成员管理', path: '/family-members', description: '老人/儿童档案', iconBgClass: 'bg-orange-50 dark:bg-orange-900/20 text-orange-500' },
  { icon: 'location_on', label: '地址管理', path: '/address', iconBgClass: 'bg-teal-50 dark:bg-teal-900/20 text-teal-600' },
  { icon: 'headset_mic', label: '在线客服', path: '/customer-service', iconBgClass: 'bg-blue-50 dark:bg-blue-900/20 text-primary' },
  { icon: 'settings', label: '设置', path: '/settings', iconBgClass: 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300' },
];

const MenuList = observer(function MenuList() {
  const navigate = useNavigate();

  return (
    <>
      <section className="bg-white dark:bg-slate-800 rounded-2xl shadow-soft border border-slate-100/50 dark:border-slate-700/50 overflow-hidden divide-y divide-slate-100 dark:divide-slate-700 mx-4 mt-4">
        {menuItems.slice(0, 2).map((item) => (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className="flex items-center justify-between w-full p-4 active:bg-slate-50 dark:active:bg-slate-700 cursor-pointer transition-colors group"
          >
            <div className="flex items-center gap-4">
              <div className={`flex items-center justify-center rounded-xl shrink-0 w-10 h-10 ${item.iconBgClass}`}>
                <span className="material-symbols-outlined text-[22px]">{item.icon}</span>
              </div>
              <p className="text-slate-800 dark:text-slate-200 text-[15px] font-medium leading-normal">{item.label}</p>
            </div>
            <div className="flex items-center gap-2">
              {item.description && (
                <span className="text-slate-400 text-xs hidden sm:block">{item.description}</span>
              )}
              <span className="material-symbols-outlined text-slate-400 text-xl group-hover:translate-x-0.5 transition-transform">chevron_right</span>
            </div>
          </button>
        ))}
      </section>

      <section className="bg-white dark:bg-slate-800 rounded-2xl shadow-soft border border-slate-100/50 dark:border-slate-700/50 overflow-hidden divide-y divide-slate-100 dark:divide-slate-700 mx-4 mt-4">
        {menuItems.slice(2).map((item) => (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className="flex items-center justify-between w-full p-4 active:bg-slate-50 dark:active:bg-slate-700 cursor-pointer transition-colors group"
          >
            <div className="flex items-center gap-4">
              <div className={`flex items-center justify-center rounded-xl shrink-0 w-10 h-10 ${item.iconBgClass}`}>
                <span className="material-symbols-outlined text-[22px]">{item.icon}</span>
              </div>
              <p className="text-slate-800 dark:text-slate-200 text-[15px] font-medium leading-normal">{item.label}</p>
            </div>
            <span className="material-symbols-outlined text-slate-400 text-xl group-hover:translate-x-0.5 transition-transform">chevron_right</span>
          </button>
        ))}
      </section>
    </>
  );
});

export default MenuList;
