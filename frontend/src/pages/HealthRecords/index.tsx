import { observer } from 'mobx-react-lite';
import { useNavigate } from 'react-router-dom';

const HealthRecords = observer(function HealthRecords() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark p-6">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h1 className="text-xl font-bold">健康档案</h1>
      </div>
      <div className="text-center text-gray-500 py-20">
        <span className="material-symbols-outlined text-6xl mb-4 block">folder_shared</span>
        <p>健康档案功能开发中...</p>
      </div>
    </div>
  );
});

export default HealthRecords;
