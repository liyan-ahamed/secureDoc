import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { FileText, Folder, Loader2, Shield } from 'lucide-react';
import api from '../api/axios';
import { Share } from '../types';

const ShareLink = () => {
  const { token } = useParams();
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
    <div className="min-h-screen flex items-center justify-center px-4 relative">
      <div className="w-full max-w-md glass-panel rounded-2xl overflow-hidden">
        <div className="h-14 border-b border-border px-5 flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-lg flex items-center justify-center bg-accent text-white shadow-lg shadow-indigo-500/20">
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
                className="mt-6 inline-flex py-2.5 px-4 rounded-xl bg-accent text-white text-sm font-medium items-center hover:bg-accent-hover hover:shadow-lg hover:shadow-indigo-500/25 transition-all"
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
