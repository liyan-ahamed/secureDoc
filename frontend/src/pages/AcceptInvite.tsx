import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Loader2, ShieldAlert, CheckCircle2 } from 'lucide-react';
import api from '../api/axios';
import AppShell from '../components/AppShell';
import { useAuthStore } from '../store/authStore';

export default function AcceptInvite() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!token) return;

    const acceptInvite = async () => {
      try {
        await api.post(`/orgs/invite/${token}/accept`);
        setStatus('success');
      } catch (error: any) {
        setStatus('error');
        setErrorMessage(error.response?.data?.error?.message || 'Failed to accept invitation.');
      }
    };

    acceptInvite();
  }, [token]);

  return (
    <AppShell>
      <div className="min-h-full flex items-center justify-center p-4">
        <div className="max-w-md w-full glass-panel rounded-2xl p-8 text-center">
          {status === 'loading' && (
            <div className="flex flex-col items-center">
              <Loader2 className="w-12 h-12 text-accent animate-spin mb-4" />
              <h2 className="text-xl font-semibold text-primary">Joining Organization...</h2>
              <p className="text-sm text-muted mt-2">Please wait while we process your invitation.</p>
            </div>
          )}

          {status === 'success' && (
            <div className="flex flex-col items-center">
              <div className="w-14 h-14 rounded-full bg-success/10 text-success border border-success/20 flex items-center justify-center mb-4">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-semibold text-primary">Successfully Joined!</h2>
              <p className="text-sm text-muted mt-2 mb-6">
                You are now a member of the organization. You can access its files and manage members based on your role.
              </p>
              <button
                onClick={() => {
                  window.location.href = '/dashboard';
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-accent text-white text-sm font-medium hover:bg-accent-hover hover:shadow-lg hover:shadow-indigo-500/25 transition-all cursor-pointer"
              >
                Go to Dashboard
              </button>
            </div>
          )}

          {status === 'error' && (
            <div className="flex flex-col items-center">
              <div className="w-14 h-14 rounded-full bg-danger/10 text-danger border border-danger/20 flex items-center justify-center mb-4">
                <ShieldAlert className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-semibold text-primary">Invitation Error</h2>
              <p className="text-sm text-muted mt-2 mb-6">{errorMessage}</p>
              
              <div className="flex flex-col gap-3 w-full">
                <Link
                  to="/dashboard"
                  className="w-full py-2 px-4 flex items-center justify-center rounded-md border border-border text-primary text-sm font-medium hover:bg-bg transition-colors"
                >
                  Return to Dashboard
                </Link>
                {errorMessage.includes('email') && (
                  <button
                    onClick={() => {
                      useAuthStore.getState().logout();
                      navigate('/login');
                    }}
                    className="text-xs text-muted hover:text-primary transition-colors cursor-pointer"
                  >
                    Logged in as the wrong user? Click here to logout.
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
