import { FormEvent, useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Check, ClipboardCheck, Loader2, X } from 'lucide-react';
import api from '../api/axios';
import Navbar from '../components/Navbar';
import { SecureFile } from '../types';
import { useAuthStore } from '../store/authStore';

type PendingFile = SecureFile & { owner: { id: string; name: string; email: string } };

const formatSize = (bytes: number) => bytes < 1024 ? `${bytes} B` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
const formatDate = (value: string) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));

export default function Approvals() {
  const { user } = useAuthStore();
  const role = user?.orgMemberships?.[0]?.role;
  const allowed = user?.accountType === 'ORGANIZATION' && (role === 'OWNER' || role === 'ADMIN');
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejecting, setRejecting] = useState<PendingFile | null>(null);
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try { const response = await api.get('/approvals/pending'); setFiles(response.data.data.files); setErrorMessage(''); }
    catch { setErrorMessage('Could not load approvals. Please try again.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { if (allowed) void load(); }, [allowed]);
  if (!allowed) return <Navigate to="/dashboard" replace />;

  const approve = async (file: PendingFile) => {
    setBusyId(file.id);
    try { await api.post(`/approvals/${file.id}/approve`); setFiles((items) => items.filter((item) => item.id !== file.id)); setMessage(`Approved ${file.originalName}`); }
    catch { setErrorMessage(`Could not approve ${file.originalName}. Please try again.`); }
    finally { setBusyId(null); }
  };
  const reject = async (event: FormEvent) => {
    event.preventDefault();
    if (!rejecting) return;
    setBusyId(rejecting.id);
    try { await api.post(`/approvals/${rejecting.id}/reject`, { reason }); setFiles((items) => items.filter((item) => item.id !== rejecting.id)); setMessage(`Rejected ${rejecting.originalName}`); setRejecting(null); setReason(''); }
    catch { setErrorMessage(`Could not reject ${rejecting.originalName}. Please try again.`); }
    finally { setBusyId(null); }
  };

  return <div className="min-h-screen"><Navbar /><main className="max-w-6xl mx-auto px-4 sm:px-6 py-5 sm:py-8">
    <div className="flex items-center justify-between mb-6"><div><div className="flex items-center gap-2 text-accent"><ClipboardCheck className="w-5 h-5" /><span className="text-sm font-medium">Organization workflow</span></div><h1 className="text-2xl font-semibold text-primary mt-1">Approvals</h1><p className="text-sm text-muted mt-1">Review member uploads before they become visible to the organization.</p></div><Link to="/dashboard" className="text-sm text-accent hover:text-primary">Back to My Drive</Link></div>
    <section className="glass-panel rounded-2xl overflow-hidden">{loading ? <div className="h-56 flex items-center justify-center gap-2 text-muted"><Loader2 className="w-4 h-4 animate-spin" />Loading approvals</div> : errorMessage ? <div className="p-5 text-sm text-danger">{errorMessage}</div> : files.length === 0 ? <div className="h-56 flex flex-col items-center justify-center text-center"><ClipboardCheck className="w-10 h-10 text-accent mb-3" /><h2 className="text-base font-semibold text-primary">No pending approvals</h2><p className="text-sm text-muted mt-1">The queue is clear.</p></div> : <div className="divide-y divide-border/60">{files.map((file) => <div key={file.id} className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4 p-5 items-center"><div><p className="text-sm font-medium text-primary">{file.originalName}</p><p className="text-xs text-muted mt-1">Uploaded by {file.owner.name || file.owner.email} · {formatDate(file.createdAt)} · {formatSize(file.size)}</p></div><div className="flex flex-wrap gap-2"><button disabled={busyId === file.id} onClick={() => void approve(file)} className="min-h-11 px-3 py-2 rounded-lg bg-success/15 text-success border border-success/25 text-sm font-medium flex gap-1.5 items-center hover:bg-success/25 disabled:opacity-60">{busyId === file.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}Approve</button><button disabled={busyId === file.id} onClick={() => setRejecting(file)} className="min-h-11 px-3 py-2 rounded-lg bg-danger/15 text-danger border border-danger/25 text-sm font-medium flex gap-1.5 items-center hover:bg-danger/25 disabled:opacity-60"><X className="w-4 h-4" />Reject</button></div></div>)}</div>}</section>
    {message && <div className="fixed right-5 bottom-5 rounded-xl px-4 py-3 text-sm font-medium bg-success/15 text-success border border-success/30">{message}</div>}
    {rejecting && <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-md flex items-center justify-center p-3"><form onSubmit={reject} className="glass-panel rounded-2xl w-full max-w-md max-h-[calc(100dvh-1.5rem)] overflow-y-auto p-4 sm:p-6" role="dialog" aria-modal="true" aria-label="Reject file"><h2 className="text-lg font-semibold text-primary">Reject {rejecting.originalName}</h2><p className="text-sm text-muted mt-1">Optionally tell the uploader why.</p><textarea aria-label="Rejection reason" value={reason} onChange={(e) => setReason(e.target.value)} className="w-full mt-4 min-h-24 rounded-lg bg-white/5 border border-white/10 p-3 text-sm text-primary outline-none focus:border-accent" placeholder="Optional reason" /><div className="flex justify-end gap-2 mt-4"><button type="button" onClick={() => setRejecting(null)} className="min-h-11 px-3 py-2 text-sm text-muted">Cancel</button><button disabled={busyId === rejecting.id} className="min-h-11 px-3 py-2 rounded-lg bg-danger text-white text-sm font-medium disabled:opacity-60">{busyId === rejecting.id ? 'Rejecting…' : 'Reject file'}</button></div></form></div>}
  </main></div>;
}
