import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Loader2, ShieldAlert, CheckCircle } from 'lucide-react';
import api from '../api/axios';
import Navbar from '../components/Navbar';
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
        
        // Wait a brief moment before success state to ensure backend completes
        // and user might need to re-fetch their me profile to update store in real app,
        // but for now we'll just show success and let them go to dashboard
        setStatus('success');
      } catch (error: any) {
        setStatus('error');
        setErrorMessage(error.response?.data?.error?.message || 'Failed to accept invitation.');
      }
    };

    acceptInvite();
  }, [token]);

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <Navbar />
      
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-surface border border-border rounded-lg shadow-xl p-8 text-center">
          {status === 'loading' && (
            <div className="flex flex-col items-center">
              <Loader2 className="w-12 h-12 text-accent animate-spin mb-4" />
              <h2 className="text-xl font-semibold text-primary">Joining Organization...</h2>
              <p className="text-sm text-muted mt-2">Please wait while we process your invitation.</p>
            </div>
          )}

          {status === 'success' && (
            <div className="flex flex-col items-center">
              <CheckCircle className="w-12 h-12 text-success mb-4" />
              <h2 className="text-xl font-semibold text-primary">Successfully Joined!</h2>
              <p className="text-sm text-muted mt-2 mb-6">
                You are now a member of the organization. You can access its files and manage members based on your role.
              </p>
              <button
                onClick={() => {
                  // Hard reload to fetch new auth profile and update user context
                  window.location.href = '/dashboard';
                }}
                className="w-full py-2 px-4 rounded-md bg-accent text-white text-sm font-medium hover:bg-accent-hover transition-colors"
              >
                Go to Dashboard
              </button>
            </div>
          )}

          {status === 'error' && (
            <div className="flex flex-col items-center">
              <ShieldAlert className="w-12 h-12 text-danger mb-4" />
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
                    className="text-xs text-muted hover:text-primary transition-colors"
                  >
                    Logged in as the wrong user? Click here to logout.
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
