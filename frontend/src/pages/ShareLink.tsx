import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { FileText, Folder, Loader2, Shield, Sun, Moon } from 'lucide-react';
import api from '../api/axios';
import { useTheme } from '../hooks/useTheme';
import { Share } from '../types';

const ShareLink = () => {
  const { token } = useParams();
  const { isDark, toggleTheme } = useTheme();
  const [share, setShare] = useState<Share | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadShare = async () => {
      try {
        const response = await api.get(`/shares/link/${token}`);
        setShare(response.data.data.share);
      } catch {
        setError('This share link is no longer available or has expired.');
      } finally {
        setLoading(false);
      }
    };
    void loadShare();
  }, [token]);

  const title = share?.file?.originalName || share?.folder?.name || 'Shared item';
  const Icon = share?.folder ? Folder : FileText;

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4 relative transition-colors">
      <button
        onClick={toggleTheme}
        aria-label="Toggle theme"
        title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        className="absolute top-5 right-5 w-9 h-9 rounded-md flex items-center justify-center text-muted hover:text-primary hover:bg-surface border border-border transition-colors cursor-pointer shadow-sm"
      >
        {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      </button>

      <div className="w-full max-w-md bg-surface border border-border rounded-lg shadow-sm dark:shadow-2xl dark:shadow-black/50 overflow-hidden transition-colors">
        <div className="h-14 border-b border-border px-5 flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-md flex items-center justify-center bg-accent text-bg shadow-sm">
            <Shield className="w-4 h-4" />
          </span>
          <span className="text-base font-semibold text-primary">SecureDoc</span>
        </div>
        <div className="p-6">
          {loading ? (
            <div className="h-32 flex items-center justify-center text-muted text-sm gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-accent" />
              Opening share
            </div>
          ) : error ? (
            <div className="px-4 py-3 rounded-lg bg-danger/10 border border-danger/20 text-danger text-sm">
              {error}
            </div>
          ) : share ? (
            <div>
              <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center text-accent mb-4">
                <Icon className="w-6 h-6" />
              </div>
              <h1 className="text-lg font-semibold text-primary truncate">{title}</h1>
              <p className="text-sm text-muted mt-1.5">
                Shared by <span className="text-primary font-medium">{share.owner?.name || share.owner?.email}</span> with{' '}
                <span className="text-primary font-medium">{share.permission.toLowerCase()}</span> access.
              </p>
              {share.expiresAt && (
                <p className="text-xs text-muted mt-2">Expires on {formatDate(share.expiresAt)}</p>
              )}
              <Link
                to="/login"
                className="mt-6 inline-flex py-2.5 px-4 rounded-md bg-accent text-bg text-sm font-medium items-center hover:bg-accent-hover transition-colors shadow-sm"
              >
                Sign in to open
              </Link>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

const formatDate = (value: string) => new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
}).format(new Date(value));

export default ShareLink;
