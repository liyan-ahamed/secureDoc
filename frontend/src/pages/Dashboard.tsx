import { ChangeEvent, FormEvent, MouseEvent, ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  FileArchive,
  FileImage,
  FileText,
  Folder,
  FolderPlus,
  History,
  Loader2,
  LucideIcon,
  MoreHorizontal,
  RefreshCcw,
  Share2,
  Trash2,
  Upload,
  Users,
  X,
} from 'lucide-react';
import api from '../api/axios';
import { useAuthStore } from '../store/authStore';
import { FileVersion, SecureFile, SecureFolder, Share, SharePermission } from '../types';
import Navbar from '../components/Navbar';

type Toast = { message: string; type: 'success' | 'error' };
type FolderTreeNode = SecureFolder & { children: FolderTreeNode[] };
type ViewMode = 'drive' | 'shared';
type ShareTarget = { type: 'file'; item: SecureFile } | { type: 'folder'; item: SecureFolder };
type MenuState =
  | { type: 'folder'; id: string; x: number; y: number }
  | { type: 'file'; id: string; x: number; y: number }
  | null;

const Dashboard = () => {
  const { user } = useAuthStore();
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const versionUploadInputRef = useRef<HTMLInputElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('drive');
  const [folders, setFolders] = useState<SecureFolder[]>([]);
  const [subfolders, setSubfolders] = useState<SecureFolder[]>([]);
  const [files, setFiles] = useState<SecureFile[]>([]);
  const [myShares, setMyShares] = useState<Share[]>([]);
  const [sharedWithMe, setSharedWithMe] = useState<Share[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [breadcrumb, setBreadcrumb] = useState<SecureFolder[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [menu, setMenu] = useState<MenuState>(null);
  const [folderModal, setFolderModal] = useState<{ mode: 'create' | 'rename'; folder?: SecureFolder } | null>(null);
  const [folderName, setFolderName] = useState('');
  const [versionsFile, setVersionsFile] = useState<SecureFile | null>(null);
  const [versions, setVersions] = useState<FileVersion[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [shareTarget, setShareTarget] = useState<ShareTarget | null>(null);
  const [shareEmail, setShareEmail] = useState('');
  const [sharePermission, setSharePermission] = useState<SharePermission>('VIEW');
  const [linkShare, setLinkShare] = useState(false);
  const [expiry, setExpiry] = useState('7');
  const [generatedLink, setGeneratedLink] = useState('');
  const [targetVersionFile, setTargetVersionFile] = useState<SecureFile | null>(null);

  const folderTree = useMemo(() => buildFolderTree(folders), [folders]);
  const isRootEmpty = !currentFolderId && subfolders.length === 0 && files.length === 0;
  const isEmptyFolder = currentFolderId && subfolders.length === 0 && files.length === 0;
  const activeFolder = folders.find((folder) => folder.id === menu?.id) || subfolders.find((folder) => folder.id === menu?.id);
  const activeFile = files.find((file) => file.id === menu?.id);
  const targetShares = shareTarget ? sharesForTarget(myShares, shareTarget) : [];

  useEffect(() => {
    void loadTree();
    void loadContents(null);
    void loadMyShares();
    void loadSharedWithMe();
  }, []);

  useEffect(() => {
    const closeMenu = () => setMenu(null);
    window.addEventListener('click', closeMenu);
    return () => window.removeEventListener('click', closeMenu);
  }, []);

  const showToast = (message: string, type: Toast['type'] = 'success') => {
    setToast({ message, type });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  };

  const loadTree = async () => {
    const response = await api.get('/folders');
    setFolders(response.data.data.folders);
  };

  const loadMyShares = async () => {
    const response = await api.get('/shares/mine');
    setMyShares(response.data.data.shares);
  };

  const loadSharedWithMe = async () => {
    const response = await api.get('/shares/shared-with-me');
    setSharedWithMe(response.data.data.shares);
  };

  const loadContents = async (folderId: string | null) => {
    setLoading(true);
    setMenu(null);
    setViewMode('drive');
    try {
      if (folderId) {
        const response = await api.get(`/folders/${folderId}`);
        setCurrentFolderId(folderId);
        setSubfolders(response.data.data.subfolders);
        setFiles(response.data.data.files);
        setBreadcrumb(response.data.data.path);
        setExpanded((prev) => new Set(prev).add(folderId));
      } else {
        const [folderResponse, fileResponse] = await Promise.all([
          api.get('/folders', { params: { parentId: 'root' } }),
          api.get('/files', { params: { folderId: 'root' } }),
        ]);
        setCurrentFolderId(null);
        setSubfolders(folderResponse.data.data.folders);
        setFiles(fileResponse.data.data.files);
        setBreadcrumb([]);
      }
    } catch {
      showToast('Could not load this folder', 'error');
    } finally {
      setLoading(false);
    }
  };

  const openSharedView = async () => {
    setViewMode('shared');
    setCurrentFolderId(null);
    setBreadcrumb([]);
    setMenu(null);
    setLoading(true);
    try {
      await loadSharedWithMe();
    } catch {
      showToast('Could not load shared items', 'error');
    } finally {
      setLoading(false);
    }
  };

  const submitFolder = async (event: FormEvent) => {
    event.preventDefault();
    const name = folderName.trim();
    if (!name || !folderModal) return;

    try {
      if (folderModal.mode === 'create') {
        await api.post('/folders', { name, parentId: currentFolderId });
        showToast('Folder created');
      } else {
        await api.patch(`/folders/${folderModal.folder!.id}`, { name });
        showToast('Folder renamed');
      }
      setFolderModal(null);
      await Promise.all([loadTree(), loadContents(currentFolderId)]);
    } catch {
      showToast('Could not save folder', 'error');
    }
  };

  const deleteFolder = async (folder: SecureFolder) => {
    setMenu(null);
    if (!window.confirm(`Delete "${folder.name}" and everything inside it?`)) return;

    try {
      await api.delete(`/folders/${folder.id}`);
      showToast('Folder deleted');
      const nextFolder = folder.id === currentFolderId ? null : currentFolderId;
      await Promise.all([loadTree(), loadContents(nextFolder), loadMyShares()]);
    } catch {
      showToast('Could not delete folder', 'error');
    }
  };

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    event.target.value = '';
    if (!selectedFile) return;

    const formData = new FormData();
    formData.append('file', selectedFile);
    if (currentFolderId) formData.append('folderId', currentFolderId);

    setUploading(true);
    try {
      const response = await api.post('/files/upload', formData);
      showToast(response.data.data.isNewVersion ? 'New version uploaded' : 'File uploaded');
      await Promise.all([loadContents(currentFolderId), loadTree(), loadMyShares()]);
    } catch {
      showToast('Upload failed', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleVersionUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    event.target.value = '';
    if (!selectedFile || !targetVersionFile) return;

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('fileId', targetVersionFile.id);

    setUploading(true);
    try {
      await api.post('/files/upload', formData);
      showToast('New version uploaded');
      await Promise.all([loadSharedWithMe(), currentFolderId ? loadContents(currentFolderId) : Promise.resolve()]);
    } catch {
      showToast('Edit access is required to upload a new version', 'error');
    } finally {
      setUploading(false);
      setTargetVersionFile(null);
    }
  };

  const downloadFile = async (file: SecureFile, versionId?: string) => {
    const url = versionId ? `/files/${file.id}/versions/${versionId}/download` : `/files/${file.id}/download`;
    try {
      const response = await api.get(url, { responseType: 'blob' });
      triggerDownload(response.data, file.originalName);
    } catch {
      showToast('Download failed', 'error');
    }
  };

  const deleteFile = async (file: SecureFile) => {
    setMenu(null);
    if (!window.confirm(`Delete "${file.originalName}"?`)) return;

    try {
      await api.delete(`/files/${file.id}`);
      showToast('File deleted');
      await Promise.all([loadContents(currentFolderId), loadMyShares()]);
    } catch {
      showToast('Could not delete file', 'error');
    }
  };

  const openVersions = async (file: SecureFile) => {
    setMenu(null);
    setVersionsFile(file);
    setVersions([]);
    setVersionsLoading(true);
    try {
      const response = await api.get(`/files/${file.id}/versions`);
      setVersions(response.data.data.versions);
    } catch {
      showToast('Could not load versions', 'error');
      setVersionsFile(null);
    } finally {
      setVersionsLoading(false);
    }
  };

  const restoreVersion = async (version: FileVersion) => {
    if (!versionsFile || version.isCurrent) return;
    if (!window.confirm('This will replace the current version.')) return;

    try {
      await api.post(`/files/${versionsFile.id}/versions/${version.id}/restore`);
      showToast('Version restored');
      await loadContents(currentFolderId);
      await openVersions(versionsFile);
    } catch {
      showToast('Could not restore version', 'error');
    }
  };

  const openShareModal = async (target: ShareTarget) => {
    setShareTarget(target);
    setShareEmail('');
    setSharePermission('VIEW');
    setLinkShare(false);
    setExpiry('7');
    setGeneratedLink('');
    setMenu(null);
    await loadMyShares();
  };

  const createShare = async (event: FormEvent) => {
    event.preventDefault();
    if (!shareTarget) return;

    const expiresAt = linkShare && expiry !== 'never'
      ? new Date(Date.now() + Number(expiry) * 24 * 60 * 60 * 1000).toISOString()
      : undefined;
    const payload = {
      permission: sharePermission,
      ...(shareTarget.type === 'file' ? { fileId: shareTarget.item.id } : { folderId: shareTarget.item.id }),
      ...(linkShare ? { generateLink: true, expiresAt } : { email: shareEmail }),
    };

    try {
      const response = await api.post('/shares', payload);
      if (response.data.data.share.shareToken) {
        const link = `${window.location.origin}/share/${response.data.data.share.shareToken}`;
        setGeneratedLink(link);
        await navigator.clipboard?.writeText(link);
        showToast('Share link copied');
      } else {
        showToast('Share created');
      }
      await Promise.all([loadMyShares(), loadContents(currentFolderId)]);
    } catch {
      showToast('Could not create share', 'error');
    }
  };

  const revokeShare = async (share: Share) => {
    if (!window.confirm('Revoke this share?')) return;
    try {
      await api.delete(`/shares/${share.id}`);
      showToast('Share revoked');
      await Promise.all([loadMyShares(), loadSharedWithMe(), loadContents(currentFolderId)]);
    } catch {
      showToast('Could not revoke share', 'error');
    }
  };

  const copyGeneratedLink = async () => {
    if (!generatedLink) return;
    await navigator.clipboard?.writeText(generatedLink);
    showToast('Link copied');
  };

  const handleOpenMenu = (event: MouseEvent, nextMenu: Exclude<MenuState, null>) => {
    event.preventDefault();
    event.stopPropagation();
    setMenu({ ...nextMenu, x: Math.min(event.clientX, window.innerWidth - 190), y: Math.min(event.clientY, window.innerHeight - 176) });
  };

  return (
    <div className="min-h-screen bg-bg">
      <Navbar />

      <div className="flex min-h-[calc(100vh-3.5rem)]">
        <aside className="w-72 shrink-0 border-r border-border bg-surface p-4 hidden md:block">
          <button onClick={() => { setFolderName(''); setFolderModal({ mode: 'create' }); }} className="w-full py-2 px-4 mb-4 rounded-md bg-accent text-white text-sm font-medium flex items-center justify-center gap-2 hover:bg-accent-hover cursor-pointer"><FolderPlus className="w-4 h-4" />New Folder</button>
          <button onClick={() => loadContents(null)} className={`w-full py-2 px-3 rounded-md flex items-center gap-2 text-sm text-left cursor-pointer ${viewMode === 'drive' && !currentFolderId ? 'bg-bg text-primary' : 'text-muted hover:bg-bg'}`}><Folder className="w-4 h-4 text-accent" />My Drive</button>
          <button onClick={openSharedView} className={`w-full py-2 mt-1 px-3 rounded-md flex items-center gap-2 text-sm text-left cursor-pointer ${viewMode === 'shared' ? 'bg-bg text-primary' : 'text-muted hover:bg-bg'}`}><Users className="w-4 h-4 text-accent" />Shared with me</button>
          {user?.orgMemberships && user.orgMemberships.length > 0 && (
            <Link to="/org/members" className="w-full py-2 mt-1 px-3 rounded-md flex items-center gap-2 text-sm text-left text-muted hover:bg-bg">
              <Users className="w-4 h-4 text-accent" />Members
            </Link>
          )}
          <div className="mt-3 space-y-0.5">
            {folderTree.map((folder) => (
              <FolderTreeItem key={folder.id} folder={folder} level={0} expanded={expanded} currentFolderId={currentFolderId} onToggle={(id) => setExpanded((prev) => {
                const next = new Set(prev);
                next.has(id) ? next.delete(id) : next.add(id);
                return next;
              })} onSelect={(id) => loadContents(id)} />
            ))}
          </div>
        </aside>

        <main className="flex-1 w-full max-w-7xl mx-auto px-6 py-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-5">
            <div>
              <div className="flex items-center gap-1.5 text-sm text-muted flex-wrap">
                {viewMode === 'shared' ? <span>Shared with me</span> : (
                  <>
                    <button onClick={() => loadContents(null)} className="hover:text-primary cursor-pointer">My Drive</button>
                    {breadcrumb.map((folder) => <span key={folder.id} className="flex items-center gap-1.5"><ChevronRight className="w-3.5 h-3.5" /><button onClick={() => loadContents(folder.id)} className="hover:text-primary cursor-pointer">{folder.name}</button></span>)}
                  </>
                )}
              </div>
              <h1 className="text-xl font-semibold text-primary mt-1">{viewMode === 'shared' ? 'Shared with me' : breadcrumb[breadcrumb.length - 1]?.name || 'My Drive'}</h1>
            </div>
            {viewMode === 'drive' && (
              <div className="flex items-center gap-2">
                <button onClick={() => { setFolderName(''); setFolderModal({ mode: 'create' }); }} className="md:hidden py-2 px-4 rounded-md border border-border text-sm text-primary flex items-center gap-2 cursor-pointer"><FolderPlus className="w-4 h-4" />New Folder</button>
                <button onClick={() => uploadInputRef.current?.click()} disabled={uploading} className="py-2 px-4 rounded-md bg-accent text-white text-sm font-medium flex items-center gap-2 hover:bg-accent-hover disabled:opacity-70 cursor-pointer">{uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}Upload</button>
              </div>
            )}
            <input ref={uploadInputRef} type="file" className="hidden" onChange={handleUpload} />
            <input ref={versionUploadInputRef} type="file" className="hidden" onChange={handleVersionUpload} />
          </div>

          <section className="bg-surface border border-border rounded-lg overflow-hidden">
            <TableHeader />
            {loading ? (
              <div className="h-52 flex items-center justify-center text-muted text-sm gap-2"><Loader2 className="w-4 h-4 animate-spin" />Loading documents</div>
            ) : viewMode === 'shared' ? (
              <SharedRows shares={sharedWithMe} onOpenFolder={(folder) => loadContents(folder.id)} onDownload={downloadFile} onVersions={openVersions} onUploadVersion={(file) => { setTargetVersionFile(file); versionUploadInputRef.current?.click(); }} />
            ) : isRootEmpty || isEmptyFolder ? (
              <div className="h-64 flex flex-col items-center justify-center text-center px-4">
                <Folder className="w-10 h-10 text-accent mb-3" />
                <h2 className="text-base font-semibold text-primary">{isRootEmpty ? 'Your secure drive is ready' : 'No files yet'}</h2>
                <p className="text-sm text-muted mt-1 mb-4">{isRootEmpty ? 'Create a folder or upload your first encrypted file.' : 'Upload a file to start this folder.'}</p>
                <button onClick={() => uploadInputRef.current?.click()} className="py-2 px-4 rounded-md bg-accent text-white text-sm font-medium flex items-center gap-2 hover:bg-accent-hover cursor-pointer"><Upload className="w-4 h-4" />Upload File</button>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {subfolders.map((folder) => <FolderRow key={folder.id} folder={folder} onOpen={() => loadContents(folder.id)} onShare={() => openShareModal({ type: 'folder', item: folder })} onMenu={(event) => handleOpenMenu(event, { type: 'folder', id: folder.id, x: 0, y: 0 })} />)}
                {files.map((file) => <FileRow key={file.id} file={file} onDownload={() => downloadFile(file)} onVersions={() => openVersions(file)} onShare={() => openShareModal({ type: 'file', item: file })} onMenu={(event) => handleOpenMenu(event, { type: 'file', id: file.id, x: 0, y: 0 })} />)}
              </div>
            )}
          </section>
        </main>
      </div>

      {menu && (
        <div className="fixed z-30 w-48 rounded-md border border-border bg-surface shadow-lg py-1" style={{ left: menu.x, top: menu.y }} onClick={(event) => event.stopPropagation()}>
          {menu.type === 'folder' && activeFolder ? (
            <>
              <MenuButton onClick={() => openShareModal({ type: 'folder', item: activeFolder })} icon={Share2} label="Share" />
              <MenuButton onClick={() => { setFolderName(activeFolder.name); setFolderModal({ mode: 'rename', folder: activeFolder }); setMenu(null); }} icon={MoreHorizontal} label="Rename" />
              <MenuButton onClick={() => deleteFolder(activeFolder)} icon={Trash2} label="Delete" danger />
            </>
          ) : activeFile ? (
            <>
              <MenuButton onClick={() => downloadFile(activeFile)} icon={Download} label="Download" />
              <MenuButton onClick={() => openVersions(activeFile)} icon={History} label="Versions" />
              <MenuButton onClick={() => openShareModal({ type: 'file', item: activeFile })} icon={Share2} label="Share" />
              <MenuButton onClick={() => deleteFile(activeFile)} icon={Trash2} label="Delete" danger />
            </>
          ) : null}
        </div>
      )}

      {folderModal && (
        <Modal onClose={() => setFolderModal(null)} title={folderModal.mode === 'create' ? 'New Folder' : 'Rename Folder'}>
          <form onSubmit={submitFolder} className="space-y-4">
            <input autoFocus value={folderName} onChange={(event) => setFolderName(event.target.value)} className="w-full h-10 px-3 rounded-md border border-border text-sm outline-none focus:border-accent" placeholder="Folder name" />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setFolderModal(null)} className="py-2 px-4 rounded-md border border-border text-sm text-muted cursor-pointer">Cancel</button>
              <button type="submit" className="py-2 px-4 rounded-md bg-accent text-white text-sm font-medium cursor-pointer">Save</button>
            </div>
          </form>
        </Modal>
      )}

      {shareTarget && (
        <Modal onClose={() => setShareTarget(null)} title={`Share ${shareTarget.type === 'file' ? shareTarget.item.originalName : shareTarget.item.name}`} wide>
          <form onSubmit={createShare} className="space-y-4">
            <label className="flex items-center gap-2 text-sm text-primary">
              <input type="checkbox" checked={linkShare} onChange={(event) => setLinkShare(event.target.checked)} />
              Generate a link
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px] gap-3">
              {linkShare ? (
                <select value={expiry} onChange={(event) => setExpiry(event.target.value)} className="h-10 px-3 rounded-md border border-border text-sm outline-none focus:border-accent">
                  <option value="1">1 day</option>
                  <option value="7">7 days</option>
                  <option value="30">30 days</option>
                  <option value="never">Never</option>
                </select>
              ) : (
                <input value={shareEmail} onChange={(event) => setShareEmail(event.target.value)} className="h-10 px-3 rounded-md border border-border text-sm outline-none focus:border-accent" placeholder="user@example.com" />
              )}
              <select value={sharePermission} onChange={(event) => setSharePermission(event.target.value as SharePermission)} className="h-10 px-3 rounded-md border border-border text-sm outline-none focus:border-accent">
                <option value="VIEW">View</option>
                <option value="EDIT">Edit</option>
              </select>
            </div>
            <div className="flex justify-end">
              <button type="submit" className="py-2 px-4 rounded-md bg-accent text-white text-sm font-medium cursor-pointer">{linkShare ? 'Generate Link' : 'Share'}</button>
            </div>
          </form>
          {generatedLink && (
            <div className="mt-4 flex gap-2">
              <input readOnly value={generatedLink} className="flex-1 py-2 px-3 rounded-md border border-border text-sm text-muted" />
              <button onClick={copyGeneratedLink} className="py-2 px-4 rounded-md border border-border text-sm text-primary flex items-center gap-2 cursor-pointer"><Copy className="w-4 h-4" />Copy</button>
            </div>
          )}
          <div className="mt-5 border-t border-border pt-4">
            <h3 className="text-sm font-semibold text-primary mb-2">Current Shares</h3>
            <div className="divide-y divide-border">
              {targetShares.length === 0 ? <p className="text-sm text-muted py-2">No active shares</p> : targetShares.map((share) => (
                <div key={share.id} className="py-2 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-primary truncate">{share.sharedWith?.email || 'Link share'}</p>
                    <p className="text-xs text-muted">{share.permission}{share.expiresAt ? ` | expires ${formatDate(share.expiresAt)}` : ''}</p>
                  </div>
                  <button onClick={() => revokeShare(share)} className="py-2 px-3 rounded-md border border-border text-sm text-danger cursor-pointer">Revoke</button>
                </div>
              ))}
            </div>
          </div>
        </Modal>
      )}

      {versionsFile && (
        <Modal onClose={() => setVersionsFile(null)} title="Version History" wide>
          {versionsLoading ? <div className="h-32 flex items-center justify-center text-muted text-sm gap-2"><Loader2 className="w-4 h-4 animate-spin" />Loading versions</div> : (
            <div className="divide-y divide-border">
              {versions.map((version) => (
                <div key={version.id} className="grid grid-cols-1 sm:grid-cols-[1fr_110px_152px] gap-3 items-center py-3">
                  <div>
                    <p className="text-sm font-medium text-primary">Version {version.versionNumber}{version.isCurrent && <span className="ml-2 text-xs text-success">Current</span>}</p>
                    <p className="text-xs text-muted">{formatDate(version.createdAt)} | {formatSize(version.size)} | {version.uploadedBy?.name || 'Unknown'}</p>
                  </div>
                  <button onClick={() => downloadFile(versionsFile, version.id)} className="py-2 px-3 rounded-md border border-border text-sm text-primary flex items-center justify-center gap-1.5 cursor-pointer"><Download className="w-3.5 h-3.5" />Download</button>
                  <button onClick={() => restoreVersion(version)} disabled={version.isCurrent} className="py-2 px-3 rounded-md bg-accent text-white text-sm flex items-center justify-center gap-1.5 disabled:bg-border disabled:text-muted cursor-pointer disabled:cursor-default"><RefreshCcw className="w-3.5 h-3.5" />Restore</button>
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}

      {toast && <div className={`fixed right-5 bottom-5 z-40 rounded-md px-4 py-3 text-sm text-white shadow-lg ${toast.type === 'success' ? 'bg-success' : 'bg-danger'}`}>{toast.message}</div>}
    </div>
  );
};

const TableHeader = () => (
  <div className="grid grid-cols-[1fr_112px] sm:grid-cols-[1fr_120px_112px] lg:grid-cols-[1fr_120px_150px_112px] gap-3 px-4 py-3 bg-bg text-xs font-medium text-muted uppercase items-center">
    <span>Name</span>
    <span className="hidden sm:block">Size</span>
    <span className="hidden lg:block">Modified</span>
    <span className="text-right">Actions</span>
  </div>
);

const SharedRows = ({ shares, onOpenFolder, onDownload, onVersions, onUploadVersion }: {
  shares: Share[];
  onOpenFolder: (folder: SecureFolder) => void;
  onDownload: (file: SecureFile) => void;
  onVersions: (file: SecureFile) => void;
  onUploadVersion: (file: SecureFile) => void;
}) => {
  if (shares.length === 0) {
    return (
      <div className="h-64 flex flex-col items-center justify-center text-center px-4">
        <Users className="w-10 h-10 text-accent mb-3" />
        <h2 className="text-base font-semibold text-primary">Nothing shared yet</h2>
        <p className="text-sm text-muted mt-1">Files and folders shared with you will appear here.</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border">
      {shares.map((share) => share.file ? (
        <SharedFileRow key={share.id} share={share} file={share.file} onDownload={() => onDownload(share.file!)} onVersions={() => onVersions(share.file!)} onUploadVersion={() => onUploadVersion(share.file!)} />
      ) : share.folder ? (
        <SharedFolderRow key={share.id} share={share} folder={share.folder} onOpen={() => onOpenFolder(share.folder!)} />
      ) : null)}
    </div>
  );
};

const FolderTreeItem = ({ folder, level, expanded, currentFolderId, onToggle, onSelect }: {
  folder: FolderTreeNode;
  level: number;
  expanded: Set<string>;
  currentFolderId: string | null;
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
}) => {
  const isExpanded = expanded.has(folder.id);
  const hasChildren = folder.children.length > 0;

  return (
    <div>
      <div className={`flex items-center rounded-md ${currentFolderId === folder.id ? 'bg-bg' : 'hover:bg-bg'}`} style={{ paddingLeft: `${level * 14}px` }}>
        <button onClick={() => hasChildren && onToggle(folder.id)} className="w-7 h-8 flex items-center justify-center text-muted cursor-pointer">
          {hasChildren ? isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" /> : null}
        </button>
        <button onClick={() => onSelect(folder.id)} className="min-w-0 flex-1 h-8 flex items-center gap-2 text-sm text-primary cursor-pointer">
          <Folder className="w-4 h-4 text-accent shrink-0" />
          <span className="truncate">{folder.name}</span>
        </button>
      </div>
      {isExpanded && folder.children.map((child) => <FolderTreeItem key={child.id} folder={child} level={level + 1} expanded={expanded} currentFolderId={currentFolderId} onToggle={onToggle} onSelect={onSelect} />)}
    </div>
  );
};

const FolderRow = ({ folder, onOpen, onShare, onMenu }: { folder: SecureFolder; onOpen: () => void; onShare: () => void; onMenu: (event: MouseEvent) => void }) => (
  <div onContextMenu={onMenu} className="grid grid-cols-[1fr_112px] sm:grid-cols-[1fr_120px_112px] lg:grid-cols-[1fr_120px_150px_112px] gap-3 items-center px-4 py-3 hover:bg-bg">
    <button onClick={onOpen} className="min-w-0 flex items-center gap-3 text-left cursor-pointer">
      <Folder className="w-5 h-5 text-accent shrink-0" />
      <span className="text-sm font-medium text-primary truncate">{folder.name}</span>
      {hasShares(folder) && <SharedBadge />}
    </button>
    <span className="hidden sm:block text-sm text-muted">Folder</span>
    <span className="hidden lg:block text-sm text-muted">{relativeTime(folder.updatedAt)}</span>
    <div className="justify-self-end flex items-center gap-1">
      <button onClick={onShare} className="w-8 h-8 rounded-md flex items-center justify-center text-muted hover:bg-surface cursor-pointer" title="Share"><Share2 className="w-4 h-4" /></button>
      <button onClick={onMenu} className="w-8 h-8 rounded-md flex items-center justify-center text-muted hover:bg-surface cursor-pointer" title="More"><MoreHorizontal className="w-4 h-4" /></button>
    </div>
  </div>
);

const FileRow = ({ file, onDownload, onVersions, onShare, onMenu }: { file: SecureFile; onDownload: () => void; onVersions: () => void; onShare: () => void; onMenu: (event: MouseEvent) => void }) => {
  const Icon = getFileIcon(file.mimeType);
  return (
    <div onContextMenu={onMenu} className="grid grid-cols-[1fr_112px] sm:grid-cols-[1fr_120px_112px] lg:grid-cols-[1fr_120px_150px_112px] gap-3 items-center px-4 py-3 hover:bg-bg">
      <div className="min-w-0 flex items-center gap-3">
        <Icon className="w-5 h-5 text-muted shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-primary truncate">{file.originalName}</p>
          <p className="text-xs text-muted">Version {file.currentVersion}</p>
        </div>
        {hasShares(file) && <SharedBadge />}
      </div>
      <span className="hidden sm:block text-sm text-muted">{formatSize(file.size)}</span>
      <span className="hidden lg:block text-sm text-muted">{relativeTime(file.updatedAt)}</span>
      <div className="justify-self-end flex items-center gap-1">
        <button onClick={onDownload} className="w-8 h-8 rounded-md flex items-center justify-center text-muted hover:bg-surface cursor-pointer" title="Download"><Download className="w-4 h-4" /></button>
        <button onClick={onVersions} className="w-8 h-8 rounded-md flex items-center justify-center text-muted hover:bg-surface cursor-pointer" title="Versions"><History className="w-4 h-4" /></button>
        <button onClick={onShare} className="w-8 h-8 rounded-md flex items-center justify-center text-muted hover:bg-surface cursor-pointer" title="Share"><Share2 className="w-4 h-4" /></button>
        <button onClick={onMenu} className="w-8 h-8 rounded-md flex items-center justify-center text-muted hover:bg-surface cursor-pointer" title="More"><MoreHorizontal className="w-4 h-4" /></button>
      </div>
    </div>
  );
};

const SharedFolderRow = ({ share, folder, onOpen }: { share: Share; folder: SecureFolder; onOpen: () => void }) => (
  <div className="grid grid-cols-[1fr_112px] sm:grid-cols-[1fr_120px_112px] lg:grid-cols-[1fr_120px_150px_112px] gap-3 items-center px-4 py-3 hover:bg-bg">
    <button onClick={onOpen} className="min-w-0 flex items-center gap-3 text-left cursor-pointer">
      <Folder className="w-5 h-5 text-accent shrink-0" />
      <div className="min-w-0">
        <p className="text-sm font-medium text-primary truncate">{folder.name}</p>
        <p className="text-xs text-muted">Owner: {share.owner?.name || share.owner?.email}</p>
      </div>
    </button>
    <span className="hidden sm:block text-sm text-muted">{share.permission}</span>
    <span className="hidden lg:block text-sm text-muted">{relativeTime(folder.updatedAt)}</span>
    <span className="justify-self-end text-xs text-success flex items-center gap-1"><Share2 className="w-3.5 h-3.5" />Shared</span>
  </div>
);

const SharedFileRow = ({ share, file, onDownload, onVersions, onUploadVersion }: { share: Share; file: SecureFile; onDownload: () => void; onVersions: () => void; onUploadVersion: () => void }) => {
  const Icon = getFileIcon(file.mimeType);
  return (
    <div className="grid grid-cols-[1fr_112px] sm:grid-cols-[1fr_120px_112px] lg:grid-cols-[1fr_120px_150px_112px] gap-3 items-center px-4 py-3 hover:bg-bg">
      <div className="min-w-0 flex items-center gap-3">
        <Icon className="w-5 h-5 text-muted shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-primary truncate">{file.originalName}</p>
          <p className="text-xs text-muted">Owner: {share.owner?.name || share.owner?.email} | {share.permission}</p>
        </div>
      </div>
      <span className="hidden sm:block text-sm text-muted">{formatSize(file.size)}</span>
      <span className="hidden lg:block text-sm text-muted">{relativeTime(file.updatedAt)}</span>
      <div className="justify-self-end flex items-center gap-1">
        <button onClick={onDownload} className="w-8 h-8 rounded-md flex items-center justify-center text-muted hover:bg-surface cursor-pointer" title="Download"><Download className="w-4 h-4" /></button>
        <button onClick={onVersions} className="w-8 h-8 rounded-md flex items-center justify-center text-muted hover:bg-surface cursor-pointer" title="Versions"><History className="w-4 h-4" /></button>
        {share.permission === 'EDIT' && <button onClick={onUploadVersion} className="w-8 h-8 rounded-md flex items-center justify-center text-muted hover:bg-surface cursor-pointer" title="Upload new version"><Upload className="w-4 h-4" /></button>}
      </div>
    </div>
  );
};

const SharedBadge = () => <span className="inline-flex items-center gap-1 rounded-sm border border-border px-1.5 py-0.5 text-[11px] text-muted"><Share2 className="w-3 h-3" />Shared</span>;

const MenuButton = ({ onClick, icon: Icon, label, danger = false }: { onClick: () => void; icon: LucideIcon; label: string; danger?: boolean }) => (
  <button onClick={onClick} className={`w-full h-9 px-3 flex items-center gap-2 text-sm hover:bg-bg cursor-pointer ${danger ? 'text-danger' : 'text-primary'}`}><Icon className="w-4 h-4" />{label}</button>
);

const Modal = ({ title, children, onClose, wide = false }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean }) => (
  <div className="fixed inset-0 z-40 bg-primary/30 flex items-center justify-center px-4">
    <div className={`bg-surface rounded-lg border border-border shadow-xl ${wide ? 'w-full max-w-2xl' : 'w-full max-w-md'}`}>
      <div className="h-12 px-4 border-b border-border flex items-center justify-between">
        <h2 className="text-sm font-semibold text-primary truncate pr-4">{title}</h2>
        <button onClick={onClose} className="w-8 h-8 rounded-md flex items-center justify-center text-muted hover:bg-bg cursor-pointer"><X className="w-4 h-4" /></button>
      </div>
      <div className="p-6">{children}</div>
    </div>
  </div>
);

const sharesForTarget = (shares: Share[], target: ShareTarget) => shares.filter((share) => (
  target.type === 'file' ? share.fileId === target.item.id : share.folderId === target.item.id
));

const hasShares = (item: SecureFile | SecureFolder) => Boolean(item.shares?.length);

const buildFolderTree = (folders: SecureFolder[]) => {
  const nodes = new Map<string, FolderTreeNode>();
  const roots: FolderTreeNode[] = [];
  folders.forEach((folder) => nodes.set(folder.id, { ...folder, children: [] }));
  nodes.forEach((node) => {
    if (node.parentId && nodes.has(node.parentId)) nodes.get(node.parentId)!.children.push(node);
    else roots.push(node);
  });
  const sortNodes = (items: FolderTreeNode[]) => {
    items.sort((a, b) => a.name.localeCompare(b.name));
    items.forEach((item) => sortNodes(item.children));
  };
  sortNodes(roots);
  return roots;
};

const triggerDownload = (blob: Blob, fileName: string) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

const getFileIcon = (mimeType: string) => {
  if (mimeType.startsWith('image/')) return FileImage;
  if (mimeType.includes('zip') || mimeType.includes('compressed')) return FileArchive;
  return FileText;
};

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let size = bytes / 1024;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[unit]}`;
};

const relativeTime = (value: string) => {
  const seconds = Math.round((new Date(value).getTime() - Date.now()) / 1000);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [['year', 31536000], ['month', 2592000], ['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60]];
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  for (const [unit, amount] of units) {
    if (Math.abs(seconds) >= amount) return formatter.format(Math.round(seconds / amount), unit);
  }
  return 'just now';
};

const formatDate = (value: string) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));

export default Dashboard;
