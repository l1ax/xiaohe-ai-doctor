import { observer } from 'mobx-react-lite';
import { PageLayout } from '../../components/PageLayout';

const FamilyMembers = observer(function FamilyMembers() {
  return (
    <PageLayout title="家庭成员管理">
      <div className="text-center text-gray-500 py-20">
        <span className="material-symbols-outlined text-6xl mb-4 block">diversity_3</span>
        <p>家庭成员管理功能开发中...</p>
      </div>
    </PageLayout>
  );
});

export default FamilyMembers;
