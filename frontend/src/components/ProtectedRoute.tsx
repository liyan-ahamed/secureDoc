import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import api from '../api/axios';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { isAuthenticated, logout } = useAuthStore();
  const [checking, setChecking] = useState(true);
  const [valid, setValid] = useState(false);

  useEffect(() => {
    const verifyToken = async () => {
      if (!isAuthenticated) {
        setChecking(false);
        setValid(false);
        return;
      }

      try {
        await api.get('/auth/me');
        setValid(true);
      } catch {
        logout();
        setValid(false);
      } finally {
        setChecking(false);
      }
    };

    verifyToken();
  }, [isAuthenticated, logout]);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!valid) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
