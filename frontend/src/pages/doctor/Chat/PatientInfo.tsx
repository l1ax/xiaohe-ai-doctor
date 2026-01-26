/**
 * 医生端聊天页面 - 患者信息横幅组件
 */

import React from 'react';
import { User, Calendar, Heart, Activity } from 'lucide-react';
import { PatientInfo as PatientInfoType } from './types';

interface PatientInfoProps {
  patient: PatientInfoType;
}

export const PatientInfo: React.FC<PatientInfoProps> = ({ patient }) => {
  // 脱敏处理患者姓名
  const getMaskedName = (name: string): string => {
    if (name.length <= 1) return name;
    if (name.length === 2) return name[0] + '*';
    return name[0] + '*' + name[name.length - 1];
  };

  // 获取性别显示文本和图标
  const getGenderInfo = (gender: 'male' | 'female' | 'other') => {
    switch (gender) {
      case 'male':
        return { text: '男', icon: '♂', color: 'text-blue-500' };
      case 'female':
        return { text: '女', icon: '♀', color: 'text-pink-500' };
      default:
        return { text: '未知', icon: '?', color: 'text-slate-400' };
    }
  };

  const genderInfo = getGenderInfo(patient.gender);

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-slate-800 border-b border-blue-100 dark:border-slate-700 px-4 py-3">
      <div className="flex items-center gap-3">
        {/* 患者头像 */}
        <div className="w-12 h-12 rounded-full bg-white dark:bg-slate-700 shadow-sm flex items-center justify-center overflow-hidden border-2 border-white dark:border-slate-600">
          {patient.avatar ? (
            <img
              src={patient.avatar}
              alt={patient.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <User className="w-6 h-6 text-slate-400" />
          )}
        </div>

        {/* 患者基本信息 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-base font-semibold text-slate-800 dark:text-white">
              {getMaskedName(patient.name)}
            </h3>
            <span className={`text-lg font-bold ${genderInfo.color}`}>
              {genderInfo.icon}
            </span>
            <span className="text-sm text-slate-600 dark:text-slate-300">
              {patient.age}岁
            </span>
          </div>

          {/* 在线状态 */}
          <div className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                patient.isOnline
                  ? 'bg-green-500 animate-pulse'
                  : 'bg-slate-300 dark:bg-slate-600'
              }`}
            />
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {patient.isOnline ? '在线' : '离线'}
            </span>
          </div>
        </div>

        {/* 快捷信息图标 */}
        <div className="flex items-center gap-3 text-slate-400">
          <div className="flex flex-col items-center gap-0.5">
            <Activity className="w-5 h-5" />
            <span className="text-[10px]">症状</span>
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <Heart className="w-5 h-5" />
            <span className="text-[10px]">病史</span>
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <Calendar className="w-5 h-5" />
            <span className="text-[10px]">预约</span>
          </div>
        </div>
      </div>
    </div>
  );
};
