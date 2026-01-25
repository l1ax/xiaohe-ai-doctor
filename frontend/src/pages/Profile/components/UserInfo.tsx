import { observer } from 'mobx-react-lite';
import { userStore } from '@/store';
import { useNavigate } from 'react-router-dom';

const UserInfo = observer(function UserInfo() {
  const navigate = useNavigate();
  const { user } = userStore;

  const maskPhone = (phone: string) => {
    return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
  };

  if (!user) {
    return (
      <div className="relative bg-gradient-to-br from-primary via-[#0b8bc8] to-[#0870a3] pt-12 pb-24 px-6 rounded-b-[2.5rem]">
        <div className="flex items-center justify-center mb-8">
          <h2 className="text-white text-lg font-bold tracking-wide">个人中心</h2>
        </div>
        <div className="flex items-center justify-center">
          <button
            onClick={() => navigate('/login')}
            className="px-6 py-2 bg-white/20 text-white rounded-lg"
          >
            请先登录
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative bg-gradient-to-br from-primary via-[#0b8bc8] to-[#0870a3] pt-12 pb-24 px-6 rounded-b-[2.5rem] shadow-lg overflow-hidden">
      <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-12 translate-x-12 pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-black/5 rounded-full blur-2xl translate-y-12 -translate-x-12 pointer-events-none"></div>
      <div className="relative flex items-center justify-center mb-8 z-10">
        <h2 className="text-white text-lg font-bold tracking-wide">个人中心</h2>
      </div>
      <div className="relative flex items-center gap-5 z-10">
        <div className="relative shrink-0">
          <div className="w-[88px] h-[88px] rounded-full border-[3px] border-white/40 bg-white/10 shadow-inner">
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt="avatar" className="w-full h-full rounded-full object-cover" />
            ) : (
              <div className="w-full h-full rounded-full flex items-center justify-center">
                <span className="material-symbols-outlined text-4xl text-white">person</span>
              </div>
            )}
          </div>
          <button
            onClick={() => navigate('/settings')}
            aria-label="Edit Profile"
            className="absolute bottom-0 right-0 bg-white dark:bg-slate-700 text-primary p-1.5 rounded-full shadow-md"
          >
            <span className="material-symbols-outlined text-[14px] block">edit</span>
          </button>
        </div>
        <div className="flex flex-col text-white flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1.5">
            <h1 className="text-2xl font-bold truncate tracking-tight">{user.nickname || '用户'}</h1>
            <div className="px-2.5 py-0.5 bg-gradient-to-r from-yellow-100 to-yellow-300 dark:from-yellow-600 dark:to-yellow-800 text-yellow-900 dark:text-yellow-50 text-[10px] font-bold rounded-full flex items-center gap-1 shadow-sm border border-yellow-200/50">
              <span className="material-symbols-outlined text-[12px] fill-1">diamond</span>
              <span>白银会员</span>
            </div>
          </div>
          <p className="text-blue-50/90 text-sm font-medium tracking-wide font-mono">{maskPhone(user.phone)}</p>
        </div>
        <button className="text-white/80 hover:text-white transition-colors" onClick={() => navigate('/profile')}>
          <span className="material-symbols-outlined text-2xl">qr_code_2</span>
        </button>
      </div>
    </div>
  );
});

export default UserInfo;
