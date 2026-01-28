import { useLocation, useNavigate } from 'react-router-dom';
import { observer } from 'mobx-react-lite';
import { Home, Stethoscope, CalendarDays, User } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout = observer(function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();

  const navItems = [
    { path: '/', icon: Home, label: '首页' },
    { path: '/consultations', icon: Stethoscope, label: '问诊' },
    { path: '/appointments/doctors', icon: CalendarDays, label: '挂号' },
    { path: '/profile', icon: User, label: '我的' },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="min-h-screen flex flex-col bg-background font-sans text-foreground">
      <main className="flex-1 pb-24">{children}</main>
      <nav className="fixed bottom-0 left-0 w-full bg-background border-t border-border pb-6 pt-2 px-6 z-50 shadow-[0_-5px_15px_-5px_rgba(0,0,0,0.05)]">
        <div className="flex justify-between items-center h-14 max-w-lg mx-auto">
          {navItems.map((item) => {
            const active = isActive(item.path);
            const Icon = item.icon;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={cn(
                  "flex flex-col items-center gap-1.5 w-16 transition-colors",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className={cn("w-6 h-6", active && "fill-current")} strokeWidth={active ? 2.5 : 2} />
                <span className={cn("text-[10px] font-medium", active && "font-bold")}>{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
});

export default Layout;
