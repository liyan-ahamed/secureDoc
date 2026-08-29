import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, Folder, Users, ShieldCheck, Loader2, Trash2 } from 'lucide-react';
import api from '../api/axios';
import { useAuthStore } from '../store/authStore';
import { AuditLog } from '../types';
import Navbar from '../components/Navbar';

const actions = ['ALL', 'UPLOAD', 'DOWNLOAD', 'SHARE', 'REVOKE_SHARE', 'DELETE', 'RESTORE', 'PERMANENT_DELETE', 'AUTO_PURGE', 'LOGIN', 'SIGNUP'];

const Audit = () => {
  const { user } = useAuthStore();
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

  return (
    <div className="min-h-screen">
      <Navbar />

      <div className="flex min-h-[calc(100vh-3.5rem)]">
        <aside className="w-72 shrink-0 border-r border-white/10 bg-zinc-950/35 backdrop-blur-2xl p-4 hidden lg:block">
          <Link
            to="/dashboard"
            className="w-full py-2 px-3 rounded-md flex items-center gap-2.5 text-sm text-left text-muted hover:text-primary hover:bg-bg transition-colors"
          >
            <Folder className="w-4 h-4 text-accent" />
            My Drive
          </Link>
          <Link
            to="/dashboard?view=shared"
            className="w-full py-2 mt-1 px-3 rounded-md flex items-center gap-2.5 text-sm text-left text-muted hover:text-primary hover:bg-bg transition-colors"
          >
            <Users className="w-4 h-4 text-accent" />
            Shared with me
          </Link>

          {user?.orgMemberships && user.orgMemberships.length > 0 && (
            <Link
              to="/org/members"
              className="w-full py-2 mt-1 px-3 rounded-md flex items-center gap-2.5 text-sm text-left text-muted hover:text-primary hover:bg-bg transition-colors"
            >
              <Users className="w-4 h-4 text-accent" />
              Members
            </Link>
          )}

          <div className="w-full py-2 mt-1 px-3 rounded-md flex items-center gap-2.5 text-sm text-left bg-accent/10 text-accent font-medium transition-colors">
            <ShieldCheck className="w-4 h-4 text-accent" />
            Audit
          </div>
          <Link to="/trash" className="w-full py-2 mt-1 px-3 rounded-md flex items-center gap-2.5 text-sm text-left text-muted hover:text-primary hover:bg-bg transition-colors">
            <Trash2 className="w-4 h-4 text-accent" />Trash
          </Link>
        </aside>

        <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-5 sm:py-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-5">
            <div>
              <h1 className="text-xl font-semibold text-primary flex items-center gap-2">
                <Activity className="w-5 h-5 text-accent" />
                Audit Log
              </h1>
            </div>
          <div className="flex items-center gap-2.5">
            {canViewOrg && (
              <select
                value={scope}
                onChange={(event) => setScope(event.target.value as 'mine' | 'org')}
                className="py-2 px-3 rounded-md border border-border bg-surface text-sm text-primary outline-none focus:border-accent focus:ring-1 focus:ring-accent cursor-pointer transition-colors"
              >
                <option value="mine">My activity</option>
                <option value="org">Org activity</option>
              </select>
            )}
            <select
              value={action}
              onChange={(event) => setAction(event.target.value)}
              className="py-2 px-3 rounded-md border border-border bg-surface text-sm text-primary outline-none focus:border-accent focus:ring-1 focus:ring-accent cursor-pointer transition-colors"
            >
              {filteredActions.map((item) => (
                <option key={item} value={item}>
                  {item === 'ALL' ? 'All actions' : item}
                </option>
              ))}
            </select>
          </div>
        </div>

        <section className="glass-panel rounded-2xl overflow-hidden">
          <div className="hidden sm:grid sm:grid-cols-[160px_130px_1fr] gap-3 px-4 py-3 bg-bg border-b border-border text-xs font-medium text-muted uppercase tracking-wider items-center">
            <span>Timestamp</span>
            <span>Action</span>
            <span>Details</span>
          </div>
          {loading ? (
            <div className="h-48 flex items-center justify-center text-muted text-sm gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-accent" />
              Loading activity
            </div>
          ) : logs.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-muted text-sm">
              No audit events found
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {logs.map((log) => (
                <div key={log.id} className="grid grid-cols-1 sm:grid-cols-[160px_130px_1fr] gap-2 sm:gap-3 items-center px-4 py-3 hover:bg-bg transition-colors">
                  <span className="text-sm text-muted">{formatDate(log.createdAt)}</span>
                  <span className="text-sm font-medium text-primary">
                    <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-accent/10 text-accent border border-accent/20">
                      {log.action}
                    </span>
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm text-primary font-medium">
                      {log.targetType} <span className="text-muted font-normal">|</span> {targetName(log)}
                    </p>
                    <p className="text-xs text-muted truncate mt-0.5">{metadataSummary(log.metadata)}</p>
                    {scope === 'org' && <p className="text-xs text-muted mt-0.5">By: {log.user?.email}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
        </main>
      </div>
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
