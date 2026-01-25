import { observer } from 'mobx-react-lite';
import UserInfo from './components/UserInfo';
import FeatureGrid from './components/FeatureGrid';
import VIPBanner from './components/VIPBanner';
import MenuList from './components/MenuList';

const Profile = observer(function Profile() {
  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark pb-28">
      <UserInfo />
      <FeatureGrid />
      <VIPBanner />
      <MenuList />
      <div className="flex justify-center py-4">
        <p className="text-slate-300 text-xs font-medium">Xiaohe AI Doctor v2.3.0</p>
      </div>
    </div>
  );
});

export default Profile;
