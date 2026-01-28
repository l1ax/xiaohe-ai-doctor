import { TimeSlotConfig } from './types';

interface TimeSlotItemProps {
  config: TimeSlotConfig;
  isAvailable: boolean;
  maxPatients: number;
  onToggle: () => void;
  onMaxPatientsChange: (value: number) => void;
  disabled?: boolean;
}

export const TimeSlotItem = ({
  config,
  isAvailable,
  maxPatients,
  onToggle,
  onMaxPatientsChange,
  disabled = false
}: TimeSlotItemProps) => {
  return (
    <div
      className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all ${
        isAvailable
          ? 'border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-700'
          : disabled 
            ? 'border-slate-100 bg-slate-50 dark:bg-slate-800/50 dark:border-slate-800 opacity-60' 
            : 'border-slate-200 bg-slate-50 dark:bg-slate-800 dark:border-slate-700'
      }`}
    >
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <h4 className={`text-base font-semibold ${isAvailable ? 'text-blue-900 dark:text-blue-100' : 'text-slate-700 dark:text-slate-300'}`}>
            {config.label}
          </h4>
          <span className="text-sm text-slate-500 dark:text-slate-400">
            {config.timeRange}
          </span>
        </div>
        {isAvailable && (
          <div className="flex items-center gap-2 mt-2">
            <label className="text-sm text-slate-600 dark:text-slate-400">
              最大人数：
            </label>
            <input
              type="number"
              min="1"
              max="50"
              value={maxPatients}
              onChange={(e) => onMaxPatientsChange(parseInt(e.target.value) || 1)}
              disabled={disabled}
              className={`w-20 px-2 py-1 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                disabled ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            />
            <span className="text-sm text-slate-500 dark:text-slate-400">人</span>
          </div>
        )}
      </div>

      <button
        onClick={onToggle}
        disabled={disabled}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          isAvailable 
            ? 'bg-blue-600' 
            : disabled
              ? 'bg-slate-200 dark:bg-slate-700 cursor-not-allowed'
              : 'bg-slate-300 dark:bg-slate-600'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            isAvailable ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );
};
