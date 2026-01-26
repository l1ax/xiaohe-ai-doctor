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
import Chat from './pages/Chat';
import DoctorList from './pages/DoctorList';
import DoctorChat from './pages/DoctorChat';
import DoctorTasks from './pages/DoctorTasks';
import Layout from './components/Layout';

// 预约模块页面
import Doctors from './pages/Appointments/Doctors';
import Schedule from './pages/Appointments/Schedule';
import Confirm from './pages/Appointments/Confirm';
import AppointmentDetail from './pages/Appointments/AppointmentDetail';

// 医生端页面
import DoctorLayout from './components/doctor/DoctorLayout';
import DoctorConsole from './pages/doctor/Console/index';
import { DoctorChatPage } from './pages/doctor/Chat';
import ScheduleManagement from './pages/doctor/Schedule';
import { AppointmentManagement } from './pages/doctor/Appointments';
import DoctorProfile from './pages/doctor/Profile';
import { ProtectedRoute, PatientRoute } from './components/shared/ProtectedRoute';

// 需要底部导航的页面包裹（患者端专用）
const withPatientLayout = (element: React.ReactNode) => (
  <PatientRoute>{element}</PatientRoute>
);

// 需要底部导航的页面包裹（带Layout）
const withLayout = (element: React.ReactNode) => <Layout>{element}</Layout>;

export const router = createBrowserRouter([
  { path: '/login', element: <Login /> },
  { path: '/', element: withPatientLayout(withLayout(<Home />)) },
  { path: '/profile', element: withPatientLayout(withLayout(<Profile />)) },
  { path: '/settings', element: <PatientRoute><Settings /></PatientRoute> },
  { path: '/appointments', element: withPatientLayout(withLayout(<Appointments />)) },
  { path: '/appointments/doctors', element: withPatientLayout(withLayout(<Doctors />)) },
  { path: '/appointments/schedule', element: withPatientLayout(withLayout(<Schedule />)) },
  { path: '/appointments/confirm', element: withPatientLayout(withLayout(<Confirm />)) },
  { path: '/appointments/:id', element: withPatientLayout(withLayout(<AppointmentDetail />)) },
  { path: '/consultations', element: withPatientLayout(withLayout(<Consultations />)) },
  { path: '/prescriptions', element: withPatientLayout(withLayout(<Prescriptions />)) },
  { path: '/health-records', element: withPatientLayout(withLayout(<HealthRecords />)) },
  { path: '/family-members', element: withPatientLayout(withLayout(<FamilyMembers />)) },
  { path: '/address', element: withPatientLayout(withLayout(<Address />)) },
  { path: '/customer-service', element: withPatientLayout(withLayout(<CustomerService />)) },
  { path: '/vip', element: withPatientLayout(withLayout(<VIP />)) },
  { path: '/booking', element: withPatientLayout(withLayout(<div>挂号页面（开发中）</div>)) },
  { path: '/chat', element: <Chat /> },
  { path: '/doctor-list', element: withPatientLayout(withLayout(<DoctorList />)) },
  { path: '/doctor-chat/:id', element: <PatientRoute><DoctorChat /></PatientRoute> },
  { path: '/doctor-tasks', element: <PatientRoute><DoctorTasks /></PatientRoute> },

  // 医生端路由
  {
    path: '/doctor',
    element: <DoctorLayout />,
    children: [
      {
        path: 'console',
        element: (
          <ProtectedRoute allowedRole="doctor">
            <DoctorConsole />
          </ProtectedRoute>
        ),
      },
      {
        path: 'chat/:id',
        element: (
          <ProtectedRoute allowedRole="doctor">
            <DoctorChatPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'schedule',
        element: (
          <ProtectedRoute allowedRole="doctor">
            <ScheduleManagement />
          </ProtectedRoute>
        ),
      },
      {
        path: 'appointments',
        element: (
          <ProtectedRoute allowedRole="doctor">
            <AppointmentManagement />
          </ProtectedRoute>
        ),
      },
      {
        path: 'profile',
        element: (
          <ProtectedRoute allowedRole="doctor">
            <DoctorProfile />
          </ProtectedRoute>
        ),
      },
    ],
  },
]);
