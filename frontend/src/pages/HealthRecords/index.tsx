import { observer } from 'mobx-react-lite';
import { PageLayout } from '../../components/PageLayout';

const HealthRecords = observer(function HealthRecords() {
  return (
    <PageLayout title="健康档案">
      <div className="text-center text-gray-500 py-20">
        <span className="material-symbols-outlined text-6xl mb-4 block">folder_shared</span>
        <p>健康档案功能开发中...</p>
      </div>
    </PageLayout>
  );
});

export default HealthRecords;
