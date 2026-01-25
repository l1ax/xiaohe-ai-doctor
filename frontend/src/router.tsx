import { createBrowserRouter } from 'react-router-dom';
import Login from './pages/Login';
import Home from './pages/Home';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import Appointments from './pages/Appointments';
import Consultations from './pages/Consultations';
import Prescriptions from './pages/Prescriptions';
import HealthRecords from './pages/HealthRecords';
import FamilyMembers from './pages/FamilyMembers';
import Address from './pages/Address';
import CustomerService from './pages/CustomerService';
import VIP from './pages/VIP';
import Layout from './components/Layout';

// 需要底部导航的页面包裹
const withLayout = (element: React.ReactNode) => <Layout>{element}</Layout>;

export const router = createBrowserRouter([
  { path: '/login', element: <Login /> },
  { path: '/', element: withLayout(<Home />) },
  { path: '/profile', element: withLayout(<Profile />) },
  { path: '/settings', element: <Settings /> },
  { path: '/appointments', element: withLayout(<Appointments />) },
  { path: '/consultations', element: withLayout(<Consultations />) },
  { path: '/prescriptions', element: withLayout(<Prescriptions />) },
  { path: '/health-records', element: withLayout(<HealthRecords />) },
  { path: '/family-members', element: withLayout(<FamilyMembers />) },
  { path: '/address', element: withLayout(<Address />) },
  { path: '/customer-service', element: withLayout(<CustomerService />) },
  { path: '/vip', element: withLayout(<VIP />) },
  { path: '/booking', element: withLayout(<div>挂号页面（开发中）</div>) },
  { path: '/chat', element: withLayout(<div>问诊页面（开发中）</div>) },
]);
