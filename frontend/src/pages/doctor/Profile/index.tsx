import { observer } from 'mobx-react-lite';
import { userStore } from '../../../store';

const DoctorProfile = observer(function DoctorProfile() {
  const user = userStore.user;

  const handleLogout = () => {
    userStore.logout();
    window.location.href = '/login';
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-24">
      {/* Header */}
      <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white px-6 pt-12 pb-8 rounded-b-3xl shadow-lg">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm border-2 border-white/30">
            <span className="material-symbols-outlined text-3xl">person</span>
          </div>
          <div>
            <h1 className="text-xl font-bold">{user?.name || '医生'}</h1>
            <p className="text-white/80 text-sm">{user?.phone || ''}</p>
          </div>
        </div>
        {user?.department && (
          <div className="mt-4 bg-white/10 rounded-xl px-4 py-3 backdrop-blur-sm">
            <p className="text-sm text-white/90">{user.department} · {user.hospital}</p>
          </div>
        )}
      </div>

      {/* Menu Items */}
      <div className="px-4 mt-4 space-y-3">
        <button className="w-full bg-white dark:bg-slate-900 rounded-xl px-4 py-4 flex items-center gap-4 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
          <span className="material-symbols-outlined text-slate-600">badge</span>
          <span className="flex-1 text-left font-medium text-slate-800 dark:text-slate-200">执业信息</span>
          <span className="material-symbols-outlined text-slate-400">chevron_right</span>
        </button>

        <button className="w-full bg-white dark:bg-slate-900 rounded-xl px-4 py-4 flex items-center gap-4 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
          <span className="material-symbols-outlined text-slate-600">verified</span>
          <span className="flex-1 text-left font-medium text-slate-800 dark:text-slate-200">资质认证</span>
          <span className="material-symbols-outlined text-slate-400">chevron_right</span>
        </button>

        <button className="w-full bg-white dark:bg-slate-900 rounded-xl px-4 py-4 flex items-center gap-4 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
          <span className="material-symbols-outlined text-slate-600">star</span>
          <span className="flex-1 text-left font-medium text-slate-800 dark:text-slate-200">我的评价</span>
          <span className="material-symbols-outlined text-slate-400">chevron_right</span>
        </button>

        <button className="w-full bg-white dark:bg-slate-900 rounded-xl px-4 py-4 flex items-center gap-4 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
          <span className="material-symbols-outlined text-slate-600">account_balance_wallet</span>
          <span className="flex-1 text-left font-medium text-slate-800 dark:text-slate-200">我的收入</span>
          <span className="material-symbols-outlined text-slate-400">chevron_right</span>
        </button>

        <div className="h-px bg-slate-200 dark:bg-slate-800 my-4"></div>

        <button className="w-full bg-white dark:bg-slate-900 rounded-xl px-4 py-4 flex items-center gap-4 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
          <span className="material-symbols-outlined text-slate-600">settings</span>
          <span className="flex-1 text-left font-medium text-slate-800 dark:text-slate-200">设置</span>
          <span className="material-symbols-outlined text-slate-400">chevron_right</span>
        </button>

        <button className="w-full bg-white dark:bg-slate-900 rounded-xl px-4 py-4 flex items-center gap-4 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
          <span className="material-symbols-outlined text-slate-600">help</span>
          <span className="flex-1 text-left font-medium text-slate-800 dark:text-slate-200">帮助与反馈</span>
          <span className="material-symbols-outlined text-slate-400">chevron_right</span>
        </button>

        <button
          onClick={handleLogout}
          className="w-full bg-white dark:bg-slate-900 rounded-xl px-4 py-4 flex items-center gap-4 shadow-sm hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors mt-6"
        >
          <span className="material-symbols-outlined text-red-500">logout</span>
          <span className="flex-1 text-left font-medium text-red-500">退出登录</span>
        </button>
      </div>
    </div>
  );
});

export default DoctorProfile;
