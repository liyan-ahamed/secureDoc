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
        setError('This share link is no longer available.');
      } finally {
        setLoading(false);
      }
    };
    void loadShare();
  }, [token]);

  const title = share?.file?.originalName || share?.folder?.name || 'Shared item';
  const Icon = share?.folder ? Folder : FileText;

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-surface border border-border rounded-lg shadow-sm">
        <div className="h-14 border-b border-border px-4 flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-md flex items-center justify-center bg-accent"><Shield className="w-4 h-4 text-white" /></span>
          <span className="text-base font-semibold text-primary">SecureDoc</span>
        </div>
        <div className="p-6">
          {loading ? (
            <div className="h-32 flex items-center justify-center text-muted text-sm gap-2"><Loader2 className="w-4 h-4 animate-spin" />Opening share</div>
          ) : error ? (
            <p className="text-sm text-danger">{error}</p>
          ) : share ? (
            <div>
              <Icon className="w-9 h-9 text-accent mb-3" />
              <h1 className="text-lg font-semibold text-primary truncate">{title}</h1>
              <p className="text-sm text-muted mt-1">Shared by {share.owner?.name || share.owner?.email} with {share.permission.toLowerCase()} access.</p>
              {share.expiresAt && <p className="text-xs text-muted mt-2">Expires {formatDate(share.expiresAt)}</p>}
              <Link to="/login" className="mt-5 inline-flex py-2 px-4 rounded-md bg-accent text-white text-sm font-medium items-center">Sign in to open</Link>
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
