import { useLocation, useNavigate } from 'react-router-dom';
import { observer } from 'mobx-react-lite';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout = observer(function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();

  const navItems = [
    { path: '/', icon: 'home', label: '首页', activeIcon: 'home' },
    { path: '/consultations', icon: 'medical_services', label: '问诊', hasBadge: true },
    { path: '/appointments/doctors', icon: 'edit_calendar', label: '挂号' },
    { path: '/profile', icon: 'person', label: '我的', activeIcon: 'person' },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1 pb-24">{children}</main>
      <nav className="fixed bottom-0 left-0 w-full bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 pb-6 pt-2 px-6 z-50 shadow-[0_-5px_15px_-5px_rgba(0,0,0,0.05)]">
        <div className="flex justify-between items-center h-14 max-w-lg mx-auto">
          {navItems.map((item) => {
            const active = isActive(item.path);
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`flex flex-col items-center gap-1.5 w-16 transition-colors ${
                  active ? 'text-primary' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                }`}
              >
                <span className={`material-symbols-outlined text-[26px] ${active ? 'fill-1 drop-shadow-sm' : ''}`}>
                  {active && item.activeIcon ? item.activeIcon : item.icon}
                </span>
                <span className={`text-[10px] font-medium ${active ? 'font-bold' : ''}`}>{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
});

export default Layout;
