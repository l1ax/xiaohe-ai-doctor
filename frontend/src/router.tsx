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

export const router = createBrowserRouter([
  { path: '/login', element: <Login /> },
  { path: '/', element: <Home /> },
  { path: '/profile', element: <Profile /> },
  { path: '/settings', element: <Settings /> },
  { path: '/appointments', element: <Appointments /> },
  { path: '/consultations', element: <Consultations /> },
  { path: '/prescriptions', element: <Prescriptions /> },
  { path: '/health-records', element: <HealthRecords /> },
  { path: '/family-members', element: <FamilyMembers /> },
  { path: '/address', element: <Address /> },
  { path: '/customer-service', element: <CustomerService /> },
  { path: '/vip', element: <VIP /> },
]);
