interface NewsCardProps {
  news: {
    id: string;
    title: string;
    category: string;
    time: string;
    imageUrl: string;
  };
}

export default function NewsCard({ news }: NewsCardProps) {
  const categoryColors: Record<string, string> = {
    健康预防: 'bg-blue-50 dark:bg-blue-900/30 text-primary',
    政策解读: 'bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400',
    口腔护理: 'bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
  };

  return (
    <div className="flex bg-white dark:bg-surface-dark rounded-xl p-3 shadow-sm border border-gray-100 dark:border-gray-800 cursor-pointer hover:shadow-md transition-shadow">
      <div className="flex-1 pr-3 flex flex-col justify-between">
        <h4 className="text-sm font-bold text-text-main-light dark:text-text-main-dark line-clamp-2 leading-snug">
          {news.title}
        </h4>
        <div className="flex items-center gap-2 mt-2">
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${categoryColors[news.category] || 'bg-gray-100'}`}>
            {news.category}
          </span>
          <span className="text-[10px] text-text-sec-light dark:text-text-sec-dark">{news.time}</span>
        </div>
      </div>
      <div className="w-24 h-24 shrink-0 rounded-lg bg-gray-200 overflow-hidden relative">
        <div
          className="w-full h-full bg-center bg-cover"
          style={{ backgroundImage: `url('${news.imageUrl}')` }}
        />
      </div>
    </div>
  );
}
