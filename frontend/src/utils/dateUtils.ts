/**
 * Format appointment time string to display string
 * Handles ISO 8601 strings with or without timezone
 */
export const formatAppointmentTime = (dateString: string): string => {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;

  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hour = date.getHours();
  const minute = date.getMinutes();

  // Format period
  const getPeriod = (h: number) => {
    if (h >= 8 && h < 12) return '上午';
    if (h >= 14 && h < 18) return '下午';
    return '晚上';
  };

  return `${month}月${day}日 ${getPeriod(hour)} ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
};
