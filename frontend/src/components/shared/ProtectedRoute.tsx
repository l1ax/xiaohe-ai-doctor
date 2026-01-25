import { Navigate } from 'react-router-dom';
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
    return <Navigate to={`/${user.role}/console`} />;
  }

  return children;
};
