import { Outlet, useLocation, useNavigate } from 'react-router-dom';

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();

  const navItems = [
    { path: '/', icon: 'home', label: '首页', filled: location.pathname === '/' },
    { path: '/chat', icon: 'chat_bubble_outline', label: '问诊', hasBadge: true },
    { path: '/appointment', icon: 'calendar_month', label: '挂号' },
    { path: '/profile', icon: 'person', label: '我的' },
  ];

  return (
    <div className="min-h-screen max-w-md mx-auto bg-background-light dark:bg-background-dark">
      <Outlet />
      <nav className="fixed bottom-0 left-0 w-full bg-white dark:bg-surface-dark border-t border-gray-200 dark:border-gray-800 h-20 pb-4 px-6 z-40 max-w-md mx-auto">
        <div className="flex justify-between items-center h-14">
          {navItems.map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center justify-center gap-1 w-14 ${
                item.filled ? 'text-primary' : 'text-text-sec-light dark:text-text-sec-dark'
              }`}
            >
              <div className="relative">
                <span className="material-symbols-outlined text-[26px]">
                  {item.filled && item.icon === 'home' ? 'home' : item.icon}
                </span>
                {item.hasBadge && (
                  <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-red-500" />
                )}
              </div>
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
