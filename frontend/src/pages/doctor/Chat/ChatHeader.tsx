/**
 * 医生端聊天页面 - 顶部导航栏组件
 */

import React from 'react';
import { ChevronLeft, MoreVertical } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ChatHeaderProps {
  patientName: string;
  isOnline: boolean;
  onMoreClick?: () => void;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  patientName,
  isOnline,
  onMoreClick,
}) => {
  const navigate = useNavigate();

  // 脱敏处理患者姓名
  const getMaskedName = (name: string): string => {
    if (name.length <= 1) return name;
    if (name.length === 2) return name[0] + '*';
    return name[0] + '*' + name[name.length - 1];
  };

  return (
    <header className="sticky top-0 z-50 bg-gradient-to-r from-slate-900 to-slate-800 dark:from-slate-950 dark:to-slate-900 shadow-lg">
      <div className="flex items-center justify-between px-4 py-3">
        {/* 左侧：返回按钮 */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center justify-center p-2 rounded-full hover:bg-white/10 active:bg-white/20 transition-colors text-white"
          aria-label="返回"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>

        {/* 中间：标题和在线状态 */}
        <div className="flex-1 flex flex-col items-center">
          <h1 className="text-lg font-bold text-white">接诊中</h1>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span
              className={`w-2 h-2 rounded-full ${
                isOnline ? 'bg-green-400 animate-pulse' : 'bg-slate-400'
              }`}
            />
            <span className="text-xs text-slate-300">
              {isOnline ? '在线' : '离线'}
            </span>
          </div>
        </div>

        {/* 右侧：更多操作 */}
        <button
          onClick={onMoreClick}
          className="flex items-center justify-center p-2 rounded-full hover:bg-white/10 active:bg-white/20 transition-colors text-white"
          aria-label="更多操作"
        >
          <MoreVertical className="w-5 h-5" />
        </button>
      </div>

      {/* 患者信息条 */}
      <div className="px-4 pb-3 pt-0">
        <div className="bg-white/10 backdrop-blur-sm rounded-lg px-3 py-2 flex items-center justify-between">
          <span className="text-sm text-slate-200">
            患者：<span className="font-medium text-white">{getMaskedName(patientName)}</span>
          </span>
          <span className="text-xs text-slate-400">专家问诊</span>
        </div>
      </div>
    </header>
  );
};
