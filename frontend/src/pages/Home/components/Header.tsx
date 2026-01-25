import { useNavigate } from 'react-router-dom';

export default function Header() {
  const navigate = useNavigate();

  return (
    <div className="sticky top-0 z-50 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 pb-2">
      <div className="flex items-center justify-between p-4 pb-2">
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white dark:bg-surface-dark shadow-sm border border-gray-100 dark:border-gray-700 active:scale-95 transition-transform">
          <span className="material-symbols-outlined text-primary text-[20px] filled">location_on</span>
          <span className="text-sm font-bold text-text-main-light dark:text-text-main-dark">北京</span>
          <span className="material-symbols-outlined text-text-sec-light dark:text-text-sec-dark text-[18px]">expand_more</span>
        </button>
        <button
          onClick={() => navigate('/notifications')}
          className="relative flex items-center justify-center p-2 rounded-full hover:bg-gray-100 dark:hover:bg-surface-dark transition-colors"
        >
          <span className="material-symbols-outlined text-text-main-light dark:text-text-main-dark text-[24px]">notifications</span>
          <span className="absolute top-2 right-2.5 h-2 w-2 rounded-full bg-red-500 border-2 border-background-light dark:border-background-dark"></span>
        </button>
      </div>
    </div>
  );
}
