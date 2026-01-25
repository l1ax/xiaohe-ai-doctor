import { observer } from 'mobx-react-lite';
import { useNavigate } from 'react-router-dom';
import { userStore } from '../../store';

const Settings = observer(function Settings() {
  const navigate = useNavigate();

  const handleLogout = () => {
    userStore.logout();
    navigate('/login', { replace: true });
  };

  const toggleTheme = () => {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  };

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark">
      <div className="p-6 pb-2">
        <div className="flex items-center gap-4 mb-4">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2">
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <h1 className="text-xl font-bold">设置</h1>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl mx-4 overflow-hidden shadow-soft border border-slate-100/50 dark:border-slate-700/50">
        <button
          onClick={toggleTheme}
          className="flex items-center justify-between w-full p-4 active:bg-slate-50 dark:active:bg-slate-700 transition-colors group"
        >
          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 w-10 h-10">
              <span className="material-symbols-outlined">dark_mode</span>
            </div>
            <span className="text-slate-800 dark:text-slate-200 text-[15px] font-medium">深色模式</span>
          </div>
          <span className="material-symbols-outlined text-slate-400">
            {document.documentElement.classList.contains('dark') ? 'toggle_on' : 'toggle_off'}
          </span>
        </button>

        <button
          onClick={handleLogout}
          className="flex items-center gap-4 w-full p-4 active:bg-slate-50 dark:active:bg-slate-700 transition-colors group border-t border-slate-100 dark:border-slate-700"
        >
          <div className="flex items-center justify-center rounded-xl bg-red-50 dark:bg-red-900/20 text-red-500 w-10 h-10">
            <span className="material-symbols-outlined">logout</span>
          </div>
          <span className="text-red-500 text-[15px] font-medium">退出登录</span>
        </button>
      </div>
    </div>
  );
});

export default Settings;
