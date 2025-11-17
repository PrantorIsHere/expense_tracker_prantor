import { useEffect, useState } from 'react';
import { getCurrentSession, isAuthenticated } from '@/lib/auth';
import { AuthSession } from '@/types/auth';
import LoginPage from './LoginPage';

interface AuthGuardProps {
  children: React.ReactNode;
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuth = () => {
      if (isAuthenticated()) {
        const currentSession = getCurrentSession();
        setSession(currentSession);
      } else {
        setSession(null);
      }
      setIsLoading(false);
    };

    checkAuth();
    
    // Check auth status periodically
    const interval = setInterval(checkAuth, 60000); // Check every minute
    
    return () => clearInterval(interval);
  }, []);

  const handleAuthSuccess = (newSession: AuthSession) => {
    setSession(newSession);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (!session) {
    return <LoginPage onAuthSuccess={handleAuthSuccess} />;
  }

  return <>{children}</>;
}