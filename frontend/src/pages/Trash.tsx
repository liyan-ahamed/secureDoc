import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileArchive, FileImage, FileText, Folder, Loader2, RotateCcw, ShieldCheck, Trash2, Users } from 'lucide-react';
import api from '../api/axios';
import { TrashItem } from '../types';
import Navbar from '../components/Navbar';

const Trash = () => {
  const [items, setItems] = useState<TrashItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const totalSize = useMemo(() => items.reduce((total, item) => total + (item.type === 'file' ? item.size : 0), 0), [items]);

  const loadTrash = async () => {
    setLoading(true);
    try {
      const response = await api.get('/trash');
      setItems(response.data.data.items);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadTrash(); }, []);

  const restore = async (item: TrashItem) => {
    setBusyId(item.id);
    try {
      await api.post(`/trash/${item.type}/${item.id}/restore`);
      await loadTrash();
    } finally { setBusyId(null); }
  };

  const deleteForever = async (item: TrashItem) => {
    if (!window.confirm(`Delete "${item.name}" forever? This cannot be undone.`)) return;
    setBusyId(item.id);
    try {
      await api.delete(`/trash/${item.type}/${item.id}`);
      await loadTrash();
    } finally { setBusyId(null); }
  };

  const emptyTrash = async () => {
    if (!items.length || !window.confirm(`Delete all ${items.length} item${items.length === 1 ? '' : 's'} forever and free ${formatSize(totalSize)}? This cannot be undone.`)) return;
    setBusyId('empty');
    try {
      await api.delete('/trash/empty');
      setItems([]);
    } finally { setBusyId(null); }
  };

  return <div className="min-h-screen">
    <Navbar />
    <div className="flex min-h-[calc(100vh-3.5rem)]">
      <aside className="w-72 shrink-0 border-r border-white/10 bg-zinc-950/35 backdrop-blur-2xl p-4 hidden md:block">
        <Link to="/dashboard" className="w-full py-2 px-3 rounded-md flex items-center gap-2.5 text-sm text-muted hover:text-primary hover:bg-bg transition-colors"><Folder className="w-4 h-4 text-accent" />My Drive</Link>
        <Link to="/dashboard?view=shared" className="w-full py-2 mt-1 px-3 rounded-md flex items-center gap-2.5 text-sm text-muted hover:text-primary hover:bg-bg transition-colors"><Users className="w-4 h-4 text-accent" />Shared with me</Link>
        <Link to="/audit" className="w-full py-2 mt-1 px-3 rounded-md flex items-center gap-2.5 text-sm text-muted hover:text-primary hover:bg-bg transition-colors"><ShieldCheck className="w-4 h-4 text-accent" />Audit</Link>
        <div className="w-full py-2 mt-1 px-3 rounded-md flex items-center gap-2.5 text-sm bg-accent/10 text-accent font-medium"><Trash2 className="w-4 h-4" />Trash</div>
      </aside>
      <main className="flex-1 w-full max-w-7xl mx-auto px-6 py-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-5">
          <div><h1 className="text-xl font-semibold text-primary flex items-center gap-2"><Trash2 className="w-5 h-5 text-accent" />Trash</h1><p className="mt-1 text-sm text-muted">Items in Trash are automatically deleted after 30 days</p></div>
          <button onClick={emptyTrash} disabled={!items.length || busyId === 'empty'} className="py-2 px-4 rounded-md bg-danger text-white text-sm font-medium flex items-center gap-2 disabled:opacity-50 hover:opacity-90 transition-opacity cursor-pointer"><Trash2 className="w-4 h-4" />{busyId === 'empty' ? 'Emptying…' : `Empty Trash${items.length ? ` (${formatSize(totalSize)})` : ''}`}</button>
        </div>
        <section className="glass-panel rounded-2xl overflow-hidden">
          <div className="grid grid-cols-[1fr_90px] sm:grid-cols-[1fr_110px_180px_200px] gap-3 px-4 py-3 bg-bg border-b border-border text-xs font-medium text-muted uppercase tracking-wider"><span>Name</span><span>Size</span><span className="hidden sm:block">Deleted</span><span className="text-right">Actions</span></div>
          {loading ? <div className="h-48 flex items-center justify-center gap-2 text-sm text-muted"><Loader2 className="w-4 h-4 animate-spin text-accent" />Loading trash</div> : items.length === 0 ? <div className="h-56 flex flex-col items-center justify-center text-muted"><Trash2 className="w-10 h-10 mb-3 text-accent/60" /><p className="text-sm font-medium text-primary">Trash is empty</p><p className="text-sm mt-1">Deleted items will appear here.</p></div> : <div className="divide-y divide-border/60">{items.map((item) => <TrashRow key={`${item.type}-${item.id}`} item={item} busy={busyId === item.id} onRestore={() => restore(item)} onDelete={() => deleteForever(item)} />)}</div>}
        </section>
      </main>
    </div>
  </div>;
};

const TrashRow = ({ item, busy, onRestore, onDelete }: { item: TrashItem; busy: boolean; onRestore: () => void; onDelete: () => void }) => {
  const Icon = item.type === 'folder' ? Folder : getFileIcon(item.mimeType || '');
  return <div className="grid grid-cols-[1fr_90px] sm:grid-cols-[1fr_110px_180px_200px] gap-3 items-center px-4 py-3 hover:bg-bg transition-colors"><div className="min-w-0 flex items-center gap-3"><Icon className="w-5 h-5 shrink-0 text-accent" /><p className="text-sm font-medium text-primary truncate">{item.name}</p></div><span className="text-sm text-muted">{item.type === 'file' ? formatSize(item.size) : '—'}</span><span className="hidden sm:block text-sm text-muted">{formatDate(item.deletedAt)}</span><div className="justify-self-end flex gap-2"><button disabled={busy} onClick={onRestore} className="py-1.5 px-2.5 rounded-md border border-border text-xs font-medium text-primary hover:bg-bg disabled:opacity-50 cursor-pointer flex items-center gap-1"><RotateCcw className="w-3.5 h-3.5" />Restore</button><button disabled={busy} onClick={onDelete} className="py-1.5 px-2.5 rounded-md border border-danger/40 text-xs font-medium text-danger hover:bg-danger/10 disabled:opacity-50 cursor-pointer flex items-center gap-1"><Trash2 className="w-3.5 h-3.5" />Delete Forever</button></div></div>;
};

const getFileIcon = (mimeType: string) => mimeType.startsWith('image/') ? FileImage : mimeType.includes('zip') || mimeType.includes('compressed') ? FileArchive : FileText;
const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let size = bytes / 1024;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) { size /= 1024; unit += 1; }
  return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[unit]}`;
};
const formatDate = (value: string) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
export default Trash;
