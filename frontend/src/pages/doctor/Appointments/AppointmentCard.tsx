import { useState } from 'react';
import { formatAppointmentTime } from '../../../utils/dateUtils';
import type { Appointment } from './types';

interface AppointmentCardProps {
  appointment: Appointment;
  onConfirm: (id: string) => Promise<void>;
  onCancel: (id: string) => Promise<void>;
}

export const AppointmentCard = ({ appointment, onConfirm, onCancel }: AppointmentCardProps) => {
  const [isLoading, setIsLoading] = useState(false);

  // 脱敏显示患者姓名
  const maskName = (name: string) => {
    if (!name) return '*';
    if (name.length <= 2) {
      return name[0] + '*';
    }
    return name[0] + '*' + name[name.length - 1];
  };

  // 脱敏显示手机号
  const maskPhone = (phone: string) => {
    if (!phone) return '***';
    return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
  };

  // 获取状态标签样式
  const getStatusStyle = () => {
    switch (appointment.status) {
      case 'pending':
        return 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800';
      case 'confirmed':
        return 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800';
      case 'cancelled':
        return 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700';
      case 'completed':
        return 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800';
      default:
        return 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700';
    }
  };

  // 获取状态文字
  const getStatusText = () => {
    switch (appointment.status) {
      case 'pending':
        return '待确认';
      case 'confirmed':
        return '已确认';
      case 'cancelled':
        return '已取消';
      case 'completed':
        return '已完成';
      default:
        return '未知';
    }
  };



  // 处理确认预约
  const handleConfirm = async () => {
    if (isLoading) return;

    const confirmed = window.confirm(`确认接受 ${maskName(appointment.patientName)} 的预约吗？`);
    if (!confirmed) return;

    setIsLoading(true);
    try {
      await onConfirm(appointment.id);
    } finally {
      setIsLoading(false);
    }
  };

  // 处理取消预约
  const handleCancel = async () => {
    if (isLoading) return;

    const confirmed = window.confirm(`确认取消 ${maskName(appointment.patientName)} 的预约吗？`);
    if (!confirmed) return;

    setIsLoading(true);
    try {
      await onCancel(appointment.id);
    } finally {
      setIsLoading(false);
    }
  };

  const canConfirm = appointment.status === 'pending';
  const canCancel = appointment.status === 'pending' || appointment.status === 'confirmed';

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-700 transition-all duration-200 hover:shadow-md">
      {/* 顶部：患者信息和状态 */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          {/* 患者头像 */}
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center text-primary font-bold text-lg">
            {appointment.patientName?.[0] || '患'}
          </div>

          {/* 患者信息 */}
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
              {maskName(appointment.patientName)}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {maskPhone(appointment.patientPhone)}
            </p>
          </div>
        </div>

        {/* 状态标签 */}
        <span className={`px-3 py-1 text-xs font-medium rounded-full border ${getStatusStyle()}`}>
          {getStatusText()}
        </span>
      </div>

      {/* 预约时间 */}
      <div className="mb-3">
        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          <span className="material-symbols-outlined text-[20px] text-primary">event</span>
          <span className="font-medium">{formatAppointmentTime(appointment.appointmentTime)}</span>
        </div>
      </div>

      {/* 医院和科室 */}
      <div className="mb-4">
        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          <span className="material-symbols-outlined text-[20px] text-slate-400">local_hospital</span>
          <span>{appointment.hospital}</span>
          <span className="text-slate-400">·</span>
          <span>{appointment.department}</span>
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="flex gap-2 pt-3 border-t border-slate-100 dark:border-slate-700">
        {canConfirm && (
          <button
            onClick={handleConfirm}
            disabled={isLoading}
            className="flex-1 py-2.5 bg-primary hover:bg-primary-dark disabled:bg-slate-300 dark:disabled:bg-slate-600 text-white text-sm font-medium rounded-lg transition-colors duration-200"
          >
            {isLoading ? '处理中...' : '确认预约'}
          </button>
        )}

        {canCancel && (
          <button
            onClick={handleCancel}
            disabled={isLoading}
            className="flex-1 py-2.5 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600 disabled:border-slate-100 dark:disabled:border-slate-800 disabled:text-slate-400 dark:disabled:text-slate-500 text-slate-700 dark:text-slate-300 text-sm font-medium rounded-lg transition-colors duration-200"
          >
            {isLoading ? '处理中...' : '取消预约'}
          </button>
        )}

        {appointment.status === 'cancelled' && (
          <div className="flex-1 py-2.5 text-center text-sm text-slate-400 dark:text-slate-500">
            预约已取消
          </div>
        )}

        {appointment.status === 'completed' && (
          <div className="flex-1 py-2.5 text-center text-sm text-slate-400 dark:text-slate-500">
            预约已完成
          </div>
        )}
      </div>
    </div>
  );
};
