import Header from './components/Header';
import SearchBar from './components/SearchBar';
import FeatureCard from './components/FeatureCard';
import DepartmentGrid from './components/DepartmentGrid';
import NewsCard from './components/NewsCard';
import { mockDepartments, mockNews } from '../../mock/data';
import { Bot, Stethoscope, Calendar, ChevronRight } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark">
      <Header />
      <SearchBar />

      <main className="px-4 pb-24">
        {/* Feature Cards */}
        <div className="grid grid-cols-2 gap-3 h-64 mt-2">
          {/* AI 问诊卡片 */}
          <FeatureCard
            title="AI 智能问诊"
            subtitle="全天候极速响应"
            icon={Bot}
            gradientFrom="primary"
            gradientTo="primary-dark"
            to="/chat"
            className="col-span-1"
          />

          <div className="flex flex-col gap-3 h-full">
            {/* 专家问诊卡片 */}
            <FeatureCard
              title="专家问诊"
              subtitle="三甲名医在线"
              icon={Stethoscope}
              color="teal"
              to="/consultations"
              className="flex-1"
            />
            {/* 预约挂号卡片 */}
            <FeatureCard
              title="预约挂号"
              subtitle="省时免排队"
              icon={Calendar}
              color="indigo"
              to="/appointments"
              className="flex-1"
            />
          </div>
        </div>

        {/* Hot Departments */}
        <div className="mt-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-text-main-light dark:text-text-main-dark">热门科室</h2>
            <button className="text-primary text-sm font-semibold flex items-center hover:opacity-80 transition-opacity">
              全部 <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <DepartmentGrid departments={mockDepartments} />
        </div>

        {/* Health News */}
        <div className="mt-6">
          <h2 className="text-lg font-bold text-text-main-light dark:text-text-main-dark mb-4">健康资讯</h2>
          <div className="flex flex-col gap-3">
            {mockNews.map((news) => (
              <NewsCard key={news.id} news={news} />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
