import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Activity, ArrowLeft, Loader2, LogOut, Shield } from 'lucide-react';
import api from '../api/axios';
import { useAuthStore } from '../store/authStore';
import { AuditLog } from '../types';

const actions = ['ALL', 'UPLOAD', 'DOWNLOAD', 'SHARE', 'REVOKE_SHARE', 'DELETE', 'RESTORE', 'LOGIN', 'SIGNUP'];

const Audit = () => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [action, setAction] = useState('ALL');
  const [scope, setScope] = useState<'mine' | 'org'>('mine');
  const [loading, setLoading] = useState(true);
  const membership = user?.orgMemberships?.[0];
  const canViewOrg = membership?.role === 'OWNER' || membership?.role === 'ADMIN';

  const filteredActions = useMemo(() => actions, []);

  useEffect(() => {
    void loadLogs();
  }, [action, scope]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const response = await api.get('/audit', {
        params: {
          ...(action !== 'ALL' && { action }),
          ...(scope === 'org' && membership?.orgId && { orgId: membership.orgId }),
        },
      });
      setLogs(response.data.data.logs);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-bg">
      <nav className="h-14 bg-surface border-b border-border px-5 flex items-center justify-between">
        <Link to="/dashboard" className="flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-md flex items-center justify-center bg-accent"><Shield className="w-4 h-4 text-white" /></span>
          <span className="text-base font-semibold text-primary">SecureDoc</span>
        </Link>
        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium text-primary">{user?.name || 'User'}</p>
            <p className="text-xs text-muted">{user?.email}</p>
          </div>
          <button onClick={handleLogout} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm text-muted border border-border hover:text-primary hover:border-muted cursor-pointer"><LogOut className="w-3.5 h-3.5" />Logout</button>
        </div>
      </nav>

      <main className="w-full max-w-7xl mx-auto px-6 py-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-5">
          <div>
            <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-primary mb-2"><ArrowLeft className="w-4 h-4" />Dashboard</Link>
            <h1 className="text-xl font-semibold text-primary flex items-center gap-2"><Activity className="w-5 h-5 text-accent" />Audit Log</h1>
          </div>
          <div className="flex items-center gap-2">
            {canViewOrg && (
              <select value={scope} onChange={(event) => setScope(event.target.value as 'mine' | 'org')} className="py-2 px-3 rounded-md border border-border bg-surface text-sm text-primary">
                <option value="mine">My activity</option>
                <option value="org">Org activity</option>
              </select>
            )}
            <select value={action} onChange={(event) => setAction(event.target.value)} className="py-2 px-3 rounded-md border border-border bg-surface text-sm text-primary">
              {filteredActions.map((item) => <option key={item} value={item}>{item === 'ALL' ? 'All actions' : item}</option>)}
            </select>
          </div>
        </div>

        <section className="bg-surface border border-border rounded-lg overflow-hidden">
          <div className="grid grid-cols-[160px_130px_1fr] gap-3 px-4 py-3 bg-bg text-xs font-medium text-muted uppercase items-center">
            <span>Timestamp</span>
            <span>Action</span>
            <span>Details</span>
          </div>
          {loading ? (
            <div className="h-48 flex items-center justify-center text-muted text-sm gap-2"><Loader2 className="w-4 h-4 animate-spin" />Loading activity</div>
          ) : logs.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-muted text-sm">No audit events found</div>
          ) : (
            <div className="divide-y divide-border">
              {logs.map((log) => (
                <div key={log.id} className="grid grid-cols-1 sm:grid-cols-[160px_130px_1fr] gap-2 sm:gap-3 items-center px-4 py-3">
                  <span className="text-sm text-muted">{formatDate(log.createdAt)}</span>
                  <span className="text-sm font-medium text-primary">{log.action}</span>
                  <div className="min-w-0">
                    <p className="text-sm text-primary">{log.targetType} | {targetName(log)}</p>
                    <p className="text-xs text-muted truncate">{metadataSummary(log.metadata)}</p>
                    {scope === 'org' && <p className="text-xs text-muted">{log.user?.email}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

const targetName = (log: AuditLog) => {
  const metadata = log.metadata || {};
  return String(metadata.fileName || metadata.folderName || metadata.targetName || log.targetId);
};

const metadataSummary = (metadata?: Record<string, unknown> | null) => {
  if (!metadata) return '';
  return Object.entries(metadata).map(([key, value]) => `${key}: ${String(value)}`).join(' | ');
};

const formatDate = (value: string) => new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
}).format(new Date(value));

export default Audit;
