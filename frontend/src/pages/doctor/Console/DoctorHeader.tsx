import { observer } from 'mobx-react-lite';
import { userStore } from '../../../store/userStore';
import { doctorStore } from '../../../store/doctorStore';

export const DoctorHeader = observer(() => {
  const { user } = userStore;
  const { isOnline } = doctorStore;

  const handleToggleStatus = () => {
    doctorStore.setOnlineStatus(!isOnline);
  };

  // 脱敏显示手机号
  const maskPhone = (phone?: string) => {
    if (!phone) return '';
    return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm">
      <div className="flex items-center justify-between">
        {/* 左侧：医生信息 */}
        <div className="flex items-center gap-3">
          {/* 头像 */}
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center text-white text-xl font-bold">
            {user?.nickname?.[0] || user?.phone?.[0] || '医'}
          </div>

          {/* 医生信息 */}
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              {user?.nickname || '医生'}
              <span className="text-xs font-normal px-2 py-0.5 bg-primary/10 text-primary rounded-full">
                在线
              </span>
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {maskPhone(user?.phone)}
            </p>
          </div>
        </div>

        {/* 右侧：状态切换 */}
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-600 dark:text-slate-400">
            {isOnline ? '在线接诊' : '忙碌中'}
          </span>
          <button
            onClick={handleToggleStatus}
            className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors duration-200 ${
              isOnline ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-600'
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform duration-200 ${
                isOnline ? 'translate-x-8' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>
    </div>
  );
});
