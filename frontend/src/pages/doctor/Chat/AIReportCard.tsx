/**
 * 医生端聊天页面 - AI 初步问诊报告卡片组件
 */

import React from 'react';
import { FileText, AlertCircle, TrendingUp, Activity } from 'lucide-react';
import { AIReport } from './types';

interface AIReportCardProps {
  report: AIReport;
  onViewFullReport?: () => void;
}

export const AIReportCard: React.FC<AIReportCardProps> = ({
  report,
  onViewFullReport,
}) => {
  // 紧急程度样式
  const urgencyConfig = {
    low: {
      label: '建议关注',
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-50 dark:bg-green-900/20',
      borderColor: 'border-green-200 dark:border-green-800',
      icon: Activity,
    },
    medium: {
      label: '建议就医',
      color: 'text-yellow-600 dark:text-yellow-400',
      bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
      borderColor: 'border-yellow-200 dark:border-yellow-800',
      icon: TrendingUp,
    },
    high: {
      label: '尽快就医',
      color: 'text-red-600 dark:text-red-400',
      bgColor: 'bg-red-50 dark:bg-red-900/20',
      borderColor: 'border-red-200 dark:border-red-800',
      icon: AlertCircle,
    },
  };

  const config = urgencyConfig[report.urgencyLevel];
  const UrgencyIcon = config.icon;

  return (
    <div className={`mx-4 mb-4 rounded-lg border-2 ${config.borderColor} ${config.bgColor} overflow-hidden`}>
      {/* 标题栏 */}
      <div className={`flex items-center justify-between px-4 py-3 border-b ${config.borderColor}`}>
        <div className="flex items-center gap-2">
          <FileText className={`w-5 h-5 ${config.color}`} />
          <h3 className="font-semibold text-slate-800 dark:text-white">AI 初步问诊报告</h3>
        </div>
        <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full ${config.bgColor} border ${config.borderColor}`}>
          <UrgencyIcon className={`w-4 h-4 ${config.color}`} />
          <span className={`text-sm font-medium ${config.color}`}>{config.label}</span>
        </div>
      </div>

      {/* 内容区域 */}
      <div className="px-4 py-3 space-y-3">
        {/* 主诉症状 */}
        {report.chiefComplaint && (
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">主诉症状</p>
            <p className="text-sm text-slate-700 dark:text-slate-200 bg-white/50 dark:bg-slate-800/50 rounded px-3 py-2">
              {report.chiefComplaint}
            </p>
          </div>
        )}

        {/* 症状列表 */}
        {report.symptoms && report.symptoms.length > 0 && (
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">相关症状</p>
            <div className="flex flex-wrap gap-1.5">
              {report.symptoms.map((symptom, index) => (
                <span
                  key={index}
                  className="text-xs px-2.5 py-1 rounded-full bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700"
                >
                  {symptom}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* 既往史 */}
        {report.medicalHistory && (
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">既往史</p>
            <p className="text-sm text-slate-700 dark:text-slate-200 bg-white/50 dark:bg-slate-800/50 rounded px-3 py-2">
              {report.medicalHistory}
            </p>
          </div>
        )}

        {/* 初步判断 */}
        {report.preliminaryDiagnosis && (
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">初步判断</p>
            <p className="text-sm text-slate-700 dark:text-slate-200 bg-white/50 dark:bg-slate-800/50 rounded px-3 py-2">
              {report.preliminaryDiagnosis}
            </p>
          </div>
        )}

        {/* 建议 */}
        {report.recommendations && report.recommendations.length > 0 && (
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">AI 建议</p>
            <ul className="space-y-1">
              {report.recommendations.map((rec, index) => (
                <li
                  key={index}
                  className="text-xs text-slate-700 dark:text-slate-200 flex items-start gap-2"
                >
                  <span className="text-blue-500 mt-0.5">•</span>
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* 底部按钮 */}
      {onViewFullReport && (
        <div className="px-4 pb-3 pt-2">
          <button
            onClick={onViewFullReport}
            className="w-full py-2.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-lg transition-colors active:scale-[0.98]"
          >
            查看完整报告
          </button>
        </div>
      )}
    </div>
  );
};
