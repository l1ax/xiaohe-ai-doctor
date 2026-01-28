import { observer } from 'mobx-react-lite';
import { PageLayout } from '../../components/PageLayout';

const Prescriptions = observer(function Prescriptions() {
  return (
    <PageLayout title="电子处方">
      <div className="text-center text-gray-500 py-20">
        <span className="material-symbols-outlined text-6xl mb-4 block">receipt_long</span>
        <p>电子处方功能开发中...</p>
      </div>
    </PageLayout>
  );
});

export default Prescriptions;
