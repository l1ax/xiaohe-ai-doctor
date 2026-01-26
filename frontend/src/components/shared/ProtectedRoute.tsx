import { Navigate, useLocation } from 'react-router-dom';
import { userStore } from '@/store/userStore';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRole: 'patient' | 'doctor';
}

export const ProtectedRoute = ({ children, allowedRole }: ProtectedRouteProps) => {
  const user = userStore.user;

  if (!user) {
    return <Navigate to="/login" />;
  }

  if (user.role !== allowedRole) {
    if (user.role === 'doctor') {
      return <Navigate to="/doctor/console" replace />;
    }
    return <Navigate to="/" replace />;
  }

  return children;
};

// 患者端路由守卫组件
export const PatientRoute = ({ children }: { children: React.ReactNode }) => {
  const user = userStore.user;
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} />;
  }

  if (user.role !== 'patient') {
    return <Navigate to="/doctor/console" replace />;
  }

  return children;
};
