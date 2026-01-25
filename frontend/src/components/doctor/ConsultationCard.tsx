import { useNavigate } from 'react-router-dom';
import type { Consultation } from '../../store/doctorStore';

interface ConsultationCardProps {
  consultation: Consultation;
  onAccept: (id: string) => Promise<boolean>;
}

export const ConsultationCard = ({ consultation, onAccept }: ConsultationCardProps) => {
  const navigate = useNavigate();

  // 脱敏显示患者姓名
  const maskName = (name: string) => {
    if (name.length <= 2) {
      return name[0] + '*';
    }
    return name[0] + '*' + name[name.length - 1];
  };

  // 根据等待时间判断紧急程度
  const getUrgencyColor = () => {
    if (consultation.waitingTime && consultation.waitingTime > 30) {
      return 'bg-red-100 text-red-600 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800';
    }
    if (consultation.waitingTime && consultation.waitingTime > 15) {
      return 'bg-amber-100 text-amber-600 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800';
    }
    return 'bg-green-100 text-green-600 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800';
  };

  // 获取紧急程度标签
  const getUrgencyLabel = () => {
    if (consultation.waitingTime && consultation.waitingTime > 30) {
      return '紧急';
    }
    if (consultation.waitingTime && consultation.waitingTime > 15) {
      return '较急';
    }
    return '正常';
  };

  // 格式化等待时间
  const formatWaitingTime = (minutes?: number) => {
    if (!minutes) return '刚刚';
    if (minutes < 60) return `${minutes}分钟`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}小时${mins}分钟` : `${hours}小时`;
  };

  // 格式化创建时间
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
    return `${Math.floor(diff / 86400000)}天前`;
  };

  const handleAccept = async () => {
    const success = await onAccept(consultation.id);
    if (success) {
      navigate(`/doctor/chat/${consultation.id}`);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-700">
      {/* 顶部：患者信息和状态 */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          {/* 患者头像 */}
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-600 flex items-center justify-center text-slate-600 dark:text-slate-300 font-bold">
            {consultation.patientName?.[0] || '患'}
          </div>

          {/* 患者信息 */}
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
              {maskName(consultation.patientName)}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {formatTime(consultation.createdAt)}
            </p>
          </div>
        </div>

        {/* 紧急程度标签 */}
        <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getUrgencyColor()}`}>
          {getUrgencyLabel()}
        </span>
      </div>

      {/* 症状描述 */}
      <div className="mb-3">
        <p className="text-sm text-slate-600 dark:text-slate-300 line-clamp-2">
          {consultation.symptoms || '暂无症状描述'}
        </p>
      </div>

      {/* 底部：等待时间和操作按钮 */}
      <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-700">
        <div className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
          <span className="material-symbols-outlined text-[18px]">schedule</span>
          <span>等待 {formatWaitingTime(consultation.waitingTime)}</span>
        </div>

        <button
          onClick={handleAccept}
          className="px-4 py-2 bg-primary hover:bg-primary-dark text-white text-sm font-medium rounded-lg transition-colors duration-200"
        >
          立即接诊
        </button>
      </div>
    </div>
  );
};
