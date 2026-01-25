export default function SearchBar() {
  return (
    <div className="px-4 pb-2">
      <div className="relative group">
        <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
          <span className="material-symbols-outlined text-text-sec-light dark:text-text-sec-dark text-[22px]">search</span>
        </div>
        <input
          className="block w-full p-3 pl-10 text-sm text-text-main-light dark:text-text-main-dark bg-white dark:bg-surface-dark border-none rounded-full shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 focus:ring-2 focus:ring-primary focus:outline-none placeholder:text-text-sec-light/70 dark:placeholder:text-text-sec-dark/70 transition-all"
          placeholder="搜索症状、医生或医院"
          type="text"
        />
      </div>
    </div>
  );
}
