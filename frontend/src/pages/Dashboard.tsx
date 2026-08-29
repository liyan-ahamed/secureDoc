import { Link } from 'react-router-dom';
import { ChangeEvent, FormEvent, MouseEvent, ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  Eye,
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
  Check,
  ShieldCheck,
  ClipboardCheck,
} from 'lucide-react';
import api from '../api/axios';
import { useAuthStore } from '../store/authStore';
import { FileVersion, SecureFile, SecureFolder, Share, SharePermission, ShareUser } from '../types';
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
  const [formSaving, setFormSaving] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [menu, setMenu] = useState<MenuState>(null);
  const [folderModal, setFolderModal] = useState<{ mode: 'create' | 'rename'; folder?: SecureFolder } | null>(null);
  const [folderName, setFolderName] = useState('');
  const [versionsFile, setVersionsFile] = useState<SecureFile | null>(null);
  const [versions, setVersions] = useState<FileVersion[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [shareTarget, setShareTarget] = useState<ShareTarget | null>(null);
  const [shareEmail, setShareEmail] = useState('');
  const [userSearchResults, setUserSearchResults] = useState<ShareUser[]>([]);
  const [userSearchLoading, setUserSearchLoading] = useState(false);
  const [showUserSearch, setShowUserSearch] = useState(false);
  const [sharePermission, setSharePermission] = useState<SharePermission>('VIEW');
  const [linkShare, setLinkShare] = useState(false);
  const [expiry, setExpiry] = useState('7');
  const [generatedLink, setGeneratedLink] = useState('');
  const [targetVersionFile, setTargetVersionFile] = useState<SecureFile | null>(null);
  const [pdfPreview, setPdfPreview] = useState<{ name: string; url: string } | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const orgRole = user?.orgMemberships?.[0]?.role;
  const canApprove = Boolean(user?.accountType === 'ORGANIZATION' && (orgRole === 'OWNER' || orgRole === 'ADMIN'));

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
    if (canApprove) void loadPendingCount();
  }, []);

  useEffect(() => {
    const query = shareEmail.trim();
    if (!shareTarget || linkShare || !query) {
      setUserSearchResults([]);
      setUserSearchLoading(false);
      return;
    }

    let active = true;
    setUserSearchLoading(true);
    const timeout = setTimeout(async () => {
      try {
        const response = await api.get('/users/search', { params: { q: query } });
        if (active) setUserSearchResults(response.data.data.users);
      } catch {
        if (active) setUserSearchResults([]);
      } finally {
        if (active) setUserSearchLoading(false);
      }
    }, 300);

    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [shareEmail, shareTarget, linkShare]);

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

  const loadPendingCount = async () => {
    const response = await api.get('/approvals/pending');
    setPendingCount(response.data.data.count);
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
    } finally {
      setFormSaving(false);
    }
  };

  const deleteFolder = async (folder: SecureFolder) => {
    setMenu(null);
    if (!window.confirm(`Delete "${folder.name}" and everything inside it?`)) return;

    setFormSaving(true);
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
      showToast(response.data.data.file.status === 'PENDING' ? 'Uploaded — awaiting admin approval' : response.data.data.isNewVersion ? 'New version uploaded' : 'File uploaded');
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

  const openPdfPreview = async (file: SecureFile) => {
    if (file.mimeType !== 'application/pdf') return;

    try {
      const response = await api.get(`/files/${file.id}/download`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      setPdfPreview((current) => {
        if (current) window.URL.revokeObjectURL(current.url);
        return { name: file.originalName, url };
      });
    } catch {
      showToast('Could not open PDF preview', 'error');
    }
  };

  const closePdfPreview = () => {
    setPdfPreview((current) => {
      if (current) window.URL.revokeObjectURL(current.url);
      return null;
    });
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
    setUserSearchResults([]);
    setShowUserSearch(false);
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

    setFormSaving(true);

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
    } finally {
      setFormSaving(false);
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

  const updateSharePermission = async (shareId: string, permission: SharePermission) => {
    try {
      await api.patch(`/shares/${shareId}`, { permission });
      showToast('Share permission updated');
      await Promise.all([loadMyShares(), loadSharedWithMe(), loadContents(currentFolderId)]);
    } catch {
      showToast('Could not update share permission', 'error');
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
    <div className="min-h-screen">
      <Navbar />

      <div className="flex min-h-[calc(100vh-3.5rem)]">
        <aside className="w-72 shrink-0 border-r border-white/10 bg-zinc-950/35 backdrop-blur-2xl p-4 hidden lg:block">
          <button
            onClick={() => { setFolderName(''); setFolderModal({ mode: 'create' }); }}
            className="w-full py-2 px-4 mb-4 rounded-md bg-accent text-bg text-sm font-medium flex items-center justify-center gap-2 hover:bg-accent-hover transition-colors cursor-pointer shadow-sm"
          >
            <FolderPlus className="w-4 h-4" />
            New Folder
          </button>
          
          <button
            onClick={() => loadContents(null)}
            className={`w-full py-2 px-3 rounded-md flex items-center gap-2.5 text-sm text-left cursor-pointer transition-colors ${
              viewMode === 'drive' && !currentFolderId
                ? 'bg-accent/10 text-accent font-medium'
                : 'text-muted hover:text-primary hover:bg-bg'
            }`}
          >
            <Folder className="w-4 h-4 text-accent" />
            My Drive
          </button>

          <button
            onClick={openSharedView}
            className={`w-full py-2 mt-1 px-3 rounded-md flex items-center gap-2.5 text-sm text-left cursor-pointer transition-colors ${
              viewMode === 'shared'
                ? 'bg-accent/10 text-accent font-medium'
                : 'text-muted hover:text-primary hover:bg-bg'
            }`}
          >
            <Users className="w-4 h-4 text-accent" />
            Shared with me
          </button>

          {user?.orgMemberships && user.orgMemberships.length > 0 && (
            <Link
              to="/org/members"
              className="w-full py-2 mt-1 px-3 rounded-md flex items-center gap-2.5 text-sm text-left text-muted hover:text-primary hover:bg-bg transition-colors"
            >
              <Users className="w-4 h-4 text-accent" />
              Members
            </Link>
          )}

          {canApprove && (
            <Link to="/approvals" className="w-full py-2 mt-1 px-3 rounded-md flex items-center gap-2.5 text-sm text-left text-muted hover:text-primary hover:bg-bg transition-colors">
              <ClipboardCheck className="w-4 h-4 text-accent" />
              <span className="flex-1">Approvals</span>
              {pendingCount > 0 && <span className="min-w-5 h-5 px-1 rounded-full bg-danger text-white text-[11px] font-semibold flex items-center justify-center">{pendingCount}</span>}
            </Link>
          )}

          <Link
            to="/audit"
            className="w-full py-2 mt-1 px-3 rounded-md flex items-center gap-2.5 text-sm text-left text-muted hover:text-primary hover:bg-bg transition-colors"
          >
            <ShieldCheck className="w-4 h-4 text-accent" />
            Audit
          </Link>

          <Link
            to="/trash"
            className="w-full py-2 mt-1 px-3 rounded-md flex items-center gap-2.5 text-sm text-left text-muted hover:text-primary hover:bg-bg transition-colors"
          >
            <Trash2 className="w-4 h-4 text-accent" />
            Trash
          </Link>

          <div className="mt-4 pt-3 border-t border-border space-y-0.5">
            <p className="px-2 pb-1.5 text-xs font-semibold text-muted uppercase tracking-wider">Folders</p>
            {folderTree.map((folder) => (
              <FolderTreeItem
                key={folder.id}
                folder={folder}
                level={0}
                expanded={expanded}
                currentFolderId={currentFolderId}
                onToggle={(id) => setExpanded((prev) => {
                  const next = new Set(prev);
                  next.has(id) ? next.delete(id) : next.add(id);
                  return next;
                })}
                onSelect={(id) => loadContents(id)}
              />
            ))}
          </div>
        </aside>

        <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-5 sm:py-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-5">
            <div>
              <div className="flex items-center gap-1.5 text-sm text-muted flex-wrap">
                {viewMode === 'shared' ? (
                  <span>Shared with me</span>
                ) : (
                  <>
                    <button onClick={() => loadContents(null)} className="hover:text-primary transition-colors cursor-pointer">
                      My Drive
                    </button>
                    {breadcrumb.map((folder) => (
                      <span key={folder.id} className="flex items-center gap-1.5">
                        <ChevronRight className="w-3.5 h-3.5" />
                        <button onClick={() => loadContents(folder.id)} className="hover:text-primary transition-colors cursor-pointer">
                          {folder.name}
                        </button>
                      </span>
                    ))}
                  </>
                )}
              </div>
              <h1 className="text-xl font-semibold text-primary mt-1">
                {viewMode === 'shared' ? 'Shared with me' : breadcrumb[breadcrumb.length - 1]?.name || 'My Drive'}
              </h1>
            </div>

            {viewMode === 'drive' && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setFolderName(''); setFolderModal({ mode: 'create' }); }}
                  className="lg:hidden min-h-11 py-2 px-4 rounded-md border border-border text-sm text-primary flex items-center gap-2 hover:bg-bg transition-colors cursor-pointer"
                >
                  <FolderPlus className="w-4 h-4" />
                  New Folder
                </button>
                <button
                  onClick={() => uploadInputRef.current?.click()}
                  disabled={uploading}
                  className="py-2 px-4 rounded-md bg-accent text-bg text-sm font-medium flex items-center gap-2 hover:bg-accent-hover disabled:opacity-70 transition-colors cursor-pointer shadow-sm"
                >
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  Upload
                </button>
              </div>
            )}
            <input ref={uploadInputRef} type="file" className="hidden" onChange={handleUpload} />
            <input ref={versionUploadInputRef} type="file" className="hidden" onChange={handleVersionUpload} />
          </div>

          <section className="glass-panel rounded-2xl overflow-hidden">
            <TableHeader />
            {loading ? (
              <div className="h-52 flex items-center justify-center text-muted text-sm gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-accent" />
                Loading documents
              </div>
            ) : viewMode === 'shared' ? (
              <SharedRows
                shares={sharedWithMe}
                onOpenFolder={(folder) => loadContents(folder.id)}
                onDownload={downloadFile}
                onView={openPdfPreview}
                onVersions={openVersions}
                onUploadVersion={(file) => { setTargetVersionFile(file); versionUploadInputRef.current?.click(); }}
              />
            ) : isRootEmpty || isEmptyFolder ? (
              <div className="h-64 flex flex-col items-center justify-center text-center px-4">
                <Folder className="w-10 h-10 text-accent mb-3" />
                <h2 className="text-base font-semibold text-primary">
                  {isRootEmpty ? 'Your secure drive is ready' : 'No files yet'}
                </h2>
                <p className="text-sm text-muted mt-1 mb-4">
                  {isRootEmpty ? 'Create a folder or upload your first encrypted file.' : 'Upload a file to start this folder.'}
                </p>
                <button
                  onClick={() => uploadInputRef.current?.click()}
                  className="py-2 px-4 rounded-md bg-accent text-bg text-sm font-medium flex items-center gap-2 hover:bg-accent-hover transition-colors cursor-pointer shadow-sm"
                >
                  <Upload className="w-4 h-4" />
                  Upload File
                </button>
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {subfolders.map((folder) => (
                  <FolderRow
                    key={folder.id}
                    folder={folder}
                    onOpen={() => loadContents(folder.id)}
                    onShare={() => openShareModal({ type: 'folder', item: folder })}
                    onMenu={(event) => handleOpenMenu(event, { type: 'folder', id: folder.id, x: 0, y: 0 })}
                  />
                ))}
                {files.map((file) => (
                  <FileRow
                    key={file.id}
                    file={file}
                    onDownload={() => downloadFile(file)}
                    onView={() => openPdfPreview(file)}
                    onVersions={() => openVersions(file)}
                    onShare={() => openShareModal({ type: 'file', item: file })}
                    onMenu={(event) => handleOpenMenu(event, { type: 'file', id: file.id, x: 0, y: 0 })}
                  />
                ))}
              </div>
            )}
          </section>
        </main>
      </div>

      {menu && (
        <div
          className="fixed z-30 w-48 glass-panel rounded-xl py-1"
          style={{ left: menu.x, top: menu.y }}
          onClick={(event) => event.stopPropagation()}
        >
          {menu.type === 'folder' && activeFolder ? (
            <>
              <MenuButton onClick={() => openShareModal({ type: 'folder', item: activeFolder })} icon={Share2} label="Share" />
              <MenuButton onClick={() => { setFolderName(activeFolder.name); setFolderModal({ mode: 'rename', folder: activeFolder }); setMenu(null); }} icon={MoreHorizontal} label="Rename" />
              <MenuButton onClick={() => deleteFolder(activeFolder)} icon={Trash2} label="Delete" danger />
            </>
          ) : activeFile ? (
            <>
              {activeFile.mimeType === 'application/pdf' && <MenuButton onClick={() => { setMenu(null); void openPdfPreview(activeFile); }} icon={Eye} label="View PDF" />}
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
            <input
              autoFocus
              value={folderName}
              onChange={(event) => setFolderName(event.target.value)}
              className="w-full h-10 px-3 rounded-md border border-border text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent bg-bg text-primary placeholder-muted"
              placeholder="Folder name"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setFolderModal(null)}
                className="py-2 px-4 rounded-md border border-border text-sm text-muted hover:text-primary hover:bg-bg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={formSaving}
                className="min-h-11 py-2 px-4 rounded-md bg-accent text-bg text-sm font-medium hover:bg-accent-hover disabled:opacity-70 transition-colors cursor-pointer shadow-sm"
              >
                {formSaving && <Loader2 className="inline w-4 h-4 mr-2 animate-spin" />}Save
              </button>
            </div>
          </form>
        </Modal>
      )}

      {shareTarget && (
        <Modal onClose={() => setShareTarget(null)} title={`Share ${shareTarget.type === 'file' ? shareTarget.item.originalName : shareTarget.item.name}`} wide>
          <form onSubmit={createShare} className="space-y-4">
            <label className="flex items-center gap-2 text-sm text-primary cursor-pointer">
              <input
                type="checkbox"
                checked={linkShare}
                onChange={(event) => setLinkShare(event.target.checked)}
                className="rounded border-border text-accent focus:ring-accent"
              />
              Generate a public link
            </label>
            {!linkShare && (
              <div>
                <label htmlFor="share-user-search" className="block text-sm font-medium text-primary mb-1.5">Share with a person</label>
                <p className="text-xs text-muted">Search registered users by name or email, then select the person who should receive access.</p>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px] gap-3">
              {linkShare ? (
                <select
                  value={expiry}
                  onChange={(event) => setExpiry(event.target.value)}
                  className="h-10 px-3 rounded-md border border-border text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent bg-bg text-primary"
                >
                  <option value="1">1 day</option>
                  <option value="7">7 days</option>
                  <option value="30">30 days</option>
                  <option value="never">Never</option>
                </select>
              ) : (
                <div className="relative">
                  <input
                    id="share-user-search"
                    autoFocus
                    value={shareEmail}
                    onChange={(event) => {
                      setShareEmail(event.target.value);
                      setShowUserSearch(true);
                    }}
                    onFocus={() => shareEmail.trim() && setShowUserSearch(true)}
                    className="w-full h-10 px-3 rounded-md border border-border text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent bg-bg text-primary placeholder-muted"
                    placeholder="Search people by name or email"
                    aria-label="Search people by name or email"
                    aria-autocomplete="list"
                    aria-expanded={showUserSearch}
                  />
                  {showUserSearch && shareEmail.trim() && (
                    <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border border-border bg-bg shadow-xl">
                      {userSearchLoading ? (
                        <p className="px-3 py-2.5 text-sm text-muted">Searching users…</p>
                      ) : userSearchResults.length > 0 ? (
                        userSearchResults.map((searchUser) => (
                          <button
                            key={searchUser.id}
                            type="button"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => {
                              setShareEmail(searchUser.email);
                              setUserSearchResults([]);
                              setShowUserSearch(false);
                            }}
                            className="w-full px-3 py-2.5 text-left hover:bg-white/10 transition-colors cursor-pointer"
                          >
                            <p className="truncate text-sm font-medium text-primary">{searchUser.name}</p>
                            <p className="truncate text-xs text-muted">{searchUser.email}</p>
                          </button>
                        ))
                      ) : (
                        <p className="px-3 py-2.5 text-sm text-muted">No users found</p>
                      )}
                    </div>
                  )}
                </div>
              )}
              <select
                value={sharePermission}
                onChange={(event) => setSharePermission(event.target.value as SharePermission)}
                className="h-10 px-3 rounded-md border border-border text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent bg-bg text-primary"
              >
                <option value="VIEW">View</option>
                <option value="EDIT">Edit</option>
              </select>
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={formSaving}
                className="min-h-11 py-2 px-4 rounded-md bg-accent text-bg text-sm font-medium hover:bg-accent-hover disabled:opacity-70 transition-colors cursor-pointer shadow-sm"
              >
                {formSaving && <Loader2 className="inline w-4 h-4 mr-2 animate-spin" />}{linkShare ? 'Generate Link' : 'Share'}
              </button>
            </div>
          </form>

          {generatedLink && (
            <div className="mt-4 flex gap-2">
              <input
                readOnly
                value={generatedLink}
                className="flex-1 py-2 px-3 rounded-md border border-border text-sm text-muted bg-bg"
              />
              <button
                onClick={copyGeneratedLink}
                className="py-2 px-4 rounded-md border border-border text-sm text-primary flex items-center gap-2 hover:bg-bg transition-colors cursor-pointer"
              >
                <Copy className="w-4 h-4" />
                Copy
              </button>
            </div>
          )}

          <div className="mt-6 border-t border-border pt-4">
            <h3 className="text-sm font-semibold text-primary mb-3">Current Shares</h3>
            <div className="divide-y divide-border/60">
              {targetShares.length === 0 ? (
                <p className="text-sm text-muted py-2">No active shares</p>
              ) : (
                targetShares.map((share) => (
                  <div key={share.id} className="py-2.5 flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-primary font-medium truncate">{share.sharedWith?.email || 'Public link share'}</p>
                      {share.expiresAt && <p className="text-xs text-muted">Expires {formatDate(share.expiresAt)}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        value={share.permission}
                        onChange={(e) => updateSharePermission(share.id, e.target.value as SharePermission)}
                        className="h-8 px-2 rounded-md border border-border text-xs outline-none focus:border-accent bg-bg text-primary cursor-pointer"
                      >
                        <option value="VIEW">View</option>
                        <option value="EDIT">Edit</option>
                      </select>
                      <button
                        onClick={() => revokeShare(share)}
                        className="py-1 px-2.5 rounded-md border border-danger/30 text-xs font-medium text-danger hover:bg-danger/10 transition-colors cursor-pointer"
                      >
                        Revoke
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </Modal>
      )}

      {versionsFile && (
        <Modal onClose={() => setVersionsFile(null)} title="Version History" wide>
          {versionsLoading ? (
            <div className="h-32 flex items-center justify-center text-muted text-sm gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-accent" />
              Loading versions
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {versions.map((version) => (
                <div key={version.id} className="grid grid-cols-1 sm:grid-cols-[1fr_110px_130px] gap-3 items-center py-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-primary">Version {version.versionNumber}</p>
                      {version.isCurrent && (
                        <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-success/10 text-success border border-success/20">
                          Current
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted mt-0.5">
                      {formatDate(version.createdAt)} | {formatSize(version.size)} | {version.uploadedBy?.name || 'Unknown'}
                    </p>
                  </div>
                  <button
                    onClick={() => downloadFile(versionsFile, version.id)}
                    className="py-1.5 px-3 rounded-md border border-border text-xs font-medium text-primary flex items-center justify-center gap-1.5 hover:bg-bg transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download
                  </button>
                  <button
                    onClick={() => restoreVersion(version)}
                    disabled={version.isCurrent}
                    className="py-1.5 px-3 rounded-md bg-accent text-bg text-xs font-medium flex items-center justify-center gap-1.5 hover:bg-accent-hover disabled:opacity-40 disabled:hover:bg-accent cursor-pointer disabled:cursor-not-allowed transition-colors"
                  >
                    <RefreshCcw className="w-3.5 h-3.5" />
                    Restore
                  </button>
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}

      {pdfPreview && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-6xl h-[90vh] rounded-2xl overflow-hidden bg-zinc-950 border border-white/15 shadow-2xl shadow-black/70 flex flex-col">
            <div className="h-12 px-5 border-b border-border flex items-center justify-between shrink-0">
              <h2 className="text-sm font-semibold text-primary truncate pr-4">{pdfPreview.name}</h2>
              <button onClick={closePdfPreview} className="w-8 h-8 rounded-md flex items-center justify-center text-muted hover:text-primary hover:bg-white/10 transition-colors cursor-pointer" title="Close preview">
                <X className="w-4 h-4" />
              </button>
            </div>
            <iframe title={`Preview of ${pdfPreview.name}`} src={pdfPreview.url} className="w-full flex-1 bg-white" />
          </div>
        </div>
      )}

      {toast && (
        <div
          className={`fixed right-5 bottom-5 z-50 rounded-xl px-4 py-3 text-sm font-medium shadow-2xl shadow-black/30 flex items-center gap-2 backdrop-blur-xl transition-all ${
            toast.type === 'success'
              ? 'bg-success/15 text-success border border-success/30'
              : 'bg-danger/15 text-danger border border-danger/30'
          }`}
        >
          {toast.type === 'success' ? <Check className="w-4 h-4 shrink-0" /> : <X className="w-4 h-4 shrink-0" />}
          {toast.message}
        </div>
      )}
    </div>
  );
};

const TableHeader = () => (
  <div className="hidden sm:grid sm:grid-cols-[1fr_120px_112px] lg:grid-cols-[1fr_120px_150px_112px] gap-3 px-4 py-3 bg-bg border-b border-border text-xs font-medium text-muted uppercase tracking-wider items-center">
    <span>Name</span>
    <span className="hidden sm:block">Size</span>
    <span className="hidden lg:block">Modified</span>
    <span className="text-right">Actions</span>
  </div>
);

const SharedRows = ({ shares, onOpenFolder, onDownload, onView, onVersions, onUploadVersion }: {
  shares: Share[];
  onOpenFolder: (folder: SecureFolder) => void;
  onDownload: (file: SecureFile) => void;
  onView: (file: SecureFile) => void;
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
    <div className="divide-y divide-border/60">
      {shares.map((share) => share.file ? (
        <SharedFileRow key={share.id} share={share} file={share.file} onDownload={() => onDownload(share.file!)} onView={() => onView(share.file!)} onVersions={() => onVersions(share.file!)} onUploadVersion={() => onUploadVersion(share.file!)} />
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
  const isSelected = currentFolderId === folder.id;

  return (
    <div>
      <div
        className={`flex items-center rounded-md transition-colors ${
          isSelected ? 'bg-accent/10 text-accent font-medium' : 'hover:bg-bg text-primary'
        }`}
        style={{ paddingLeft: `${level * 14}px` }}
      >
        <button
          onClick={() => hasChildren && onToggle(folder.id)}
          className="w-7 h-8 flex items-center justify-center text-muted hover:text-primary transition-colors cursor-pointer"
        >
          {hasChildren ? isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" /> : null}
        </button>
        <button
          onClick={() => onSelect(folder.id)}
          className="min-w-0 flex-1 h-8 flex items-center gap-2 text-sm text-inherit cursor-pointer"
        >
          <Folder className={`w-4 h-4 shrink-0 ${isSelected ? 'text-accent' : 'text-accent'}`} />
          <span className="truncate">{folder.name}</span>
        </button>
      </div>
      {isExpanded && folder.children.map((child) => (
        <FolderTreeItem
          key={child.id}
          folder={child}
          level={level + 1}
          expanded={expanded}
          currentFolderId={currentFolderId}
          onToggle={onToggle}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
};

const FolderRow = ({ folder, onOpen, onShare, onMenu }: { folder: SecureFolder; onOpen: () => void; onShare: () => void; onMenu: (event: MouseEvent) => void }) => (
  <div onContextMenu={onMenu} className="grid grid-cols-1 sm:grid-cols-[1fr_120px_112px] lg:grid-cols-[1fr_120px_150px_112px] gap-3 items-center px-4 py-3 hover:bg-bg transition-colors">
    <button onClick={onOpen} className="min-w-0 flex items-center gap-3 text-left cursor-pointer group">
      <Folder className="w-5 h-5 text-accent shrink-0" />
      <span className="text-sm font-medium text-primary group-hover:text-accent transition-colors truncate">{folder.name}</span>
      {hasShares(folder) && <SharedBadge />}
    </button>
    <span className="hidden sm:block text-sm text-muted">Folder</span>
    <span className="hidden lg:block text-sm text-muted">{relativeTime(folder.updatedAt)}</span>
    <div className="justify-self-start sm:justify-self-end flex items-center gap-1">
      <button
        onClick={onShare}
        className="touch-target rounded-lg flex items-center justify-center text-muted hover:text-primary hover:bg-white/10 border border-transparent hover:border-white/10 transition-colors cursor-pointer"
        title="Share"
      >
        <Share2 className="w-4 h-4" />
      </button>
      <button
        onClick={onMenu}
        className="touch-target rounded-lg flex items-center justify-center text-muted hover:text-primary hover:bg-white/10 border border-transparent hover:border-white/10 transition-colors cursor-pointer"
        title="More"
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>
    </div>
  </div>
);

const FileRow = ({ file, onDownload, onView, onVersions, onShare, onMenu }: { file: SecureFile; onDownload: () => void; onView: () => void; onVersions: () => void; onShare: () => void; onMenu: (event: MouseEvent) => void }) => {
  const Icon = getFileIcon(file.mimeType);
  return (
    <div onContextMenu={onMenu} className={`grid grid-cols-1 sm:grid-cols-[1fr_120px_112px] lg:grid-cols-[1fr_120px_150px_112px] gap-3 items-center px-4 py-3 hover:bg-bg transition-colors ${file.status !== 'APPROVED' ? 'bg-white/[0.02] border-l-2 border-dashed border-warning/60 opacity-80' : ''}`}>
      <div className="min-w-0 flex items-center gap-3">
        <Icon className="w-5 h-5 text-muted shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-primary truncate">{file.originalName}</p>
          <p className="text-xs text-muted">Version {file.currentVersion}</p>
        </div>
        {hasShares(file) && <SharedBadge />}
        {file.status === 'PENDING' && <StatusBadge status="PENDING" />}
        {file.status === 'REJECTED' && <StatusBadge status="REJECTED" reason={file.rejectionReason} />}
      </div>
      <span className="hidden sm:block text-sm text-muted">{formatSize(file.size)}</span>
      <span className="hidden lg:block text-sm text-muted">{relativeTime(file.updatedAt)}</span>
      <div className="justify-self-start sm:justify-self-end flex flex-wrap items-center gap-1">
        {file.mimeType === 'application/pdf' && (
          <button onClick={onView} className="w-8 h-8 rounded-lg flex items-center justify-center text-muted hover:text-primary hover:bg-white/10 border border-transparent hover:border-white/10 transition-colors cursor-pointer" title="View PDF">
            <Eye className="w-4 h-4" />
          </button>
        )}
        <button
          onClick={onDownload}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-muted hover:text-primary hover:bg-white/10 border border-transparent hover:border-white/10 transition-colors cursor-pointer"
          title="Download"
        >
          <Download className="w-4 h-4" />
        </button>
        <button
          onClick={onVersions}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-muted hover:text-primary hover:bg-white/10 border border-transparent hover:border-white/10 transition-colors cursor-pointer"
          title="Versions"
        >
          <History className="w-4 h-4" />
        </button>
        <button
          onClick={onShare}
          aria-label={`Share ${file.originalName}`}
          className="min-h-11 px-3 rounded-lg inline-flex items-center justify-center gap-1.5 text-accent bg-accent/10 border border-accent/30 hover:text-primary hover:bg-accent/20 hover:border-accent/50 transition-colors cursor-pointer"
          title="Share"
        >
          <Share2 className="w-5 h-5" />
          <span className="text-xs font-medium">Share</span>
        </button>
        <button
          onClick={onMenu}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-muted hover:text-primary hover:bg-white/10 border border-transparent hover:border-white/10 transition-colors cursor-pointer"
          title="More"
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

const SharedFolderRow = ({ share, folder, onOpen }: { share: Share; folder: SecureFolder; onOpen: () => void }) => (
  <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px_112px] lg:grid-cols-[1fr_120px_150px_112px] gap-3 items-center px-4 py-3 hover:bg-bg transition-colors">
    <button onClick={onOpen} className="min-w-0 flex items-center gap-3 text-left cursor-pointer group">
      <Folder className="w-5 h-5 text-accent shrink-0" />
      <div className="min-w-0">
        <p className="text-sm font-medium text-primary group-hover:text-accent transition-colors truncate">{folder.name}</p>
        <p className="text-xs text-muted">Owner: {share.owner?.name || share.owner?.email}</p>
      </div>
    </button>
    <span className="hidden sm:block text-sm text-muted">{share.permission}</span>
    <span className="hidden lg:block text-sm text-muted">{relativeTime(folder.updatedAt)}</span>
    <span className="justify-self-start sm:justify-self-end text-xs font-medium px-2 py-0.5 rounded bg-accent/10 text-accent border border-accent/20 flex items-center gap-1">
      <Share2 className="w-3 h-3" />
      Shared
    </span>
  </div>
);

const SharedFileRow = ({ share, file, onDownload, onView, onVersions, onUploadVersion }: { share: Share; file: SecureFile; onDownload: () => void; onView: () => void; onVersions: () => void; onUploadVersion: () => void }) => {
  const Icon = getFileIcon(file.mimeType);
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px_112px] lg:grid-cols-[1fr_120px_150px_112px] gap-3 items-center px-4 py-3 hover:bg-bg transition-colors">
      <div className="min-w-0 flex items-center gap-3">
        <Icon className="w-5 h-5 text-muted shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-primary truncate">{file.originalName}</p>
          <p className="text-xs text-muted">Owner: {share.owner?.name || share.owner?.email} | {share.permission}</p>
        </div>
      </div>
      <span className="hidden sm:block text-sm text-muted">{formatSize(file.size)}</span>
      <span className="hidden lg:block text-sm text-muted">{relativeTime(file.updatedAt)}</span>
      <div className="justify-self-start sm:justify-self-end flex flex-wrap items-center gap-1">
        {file.mimeType === 'application/pdf' && (
          <button onClick={onView} className="w-8 h-8 rounded-lg flex items-center justify-center text-muted hover:text-primary hover:bg-white/10 border border-transparent hover:border-white/10 transition-colors cursor-pointer" title="View PDF">
            <Eye className="w-4 h-4" />
          </button>
        )}
        <button
          onClick={onDownload}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-muted hover:text-primary hover:bg-white/10 border border-transparent hover:border-white/10 transition-colors cursor-pointer"
          title="Download"
        >
          <Download className="w-4 h-4" />
        </button>
        <button
          onClick={onVersions}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-muted hover:text-primary hover:bg-white/10 border border-transparent hover:border-white/10 transition-colors cursor-pointer"
          title="Versions"
        >
          <History className="w-4 h-4" />
        </button>
        {share.permission === 'EDIT' && (
          <button
            onClick={onUploadVersion}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted hover:text-primary hover:bg-white/10 border border-transparent hover:border-white/10 transition-colors cursor-pointer"
            title="Upload new version"
          >
            <Upload className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};

const SharedBadge = () => (
  <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium bg-accent/10 text-accent border border-accent/20">
    <Share2 className="w-3 h-3" />
    Shared
  </span>
);

const StatusBadge = ({ status, reason }: { status: 'PENDING' | 'REJECTED'; reason?: string | null }) => (
  <span title={reason || undefined} className={`inline-flex rounded px-1.5 py-0.5 text-[11px] font-medium border ${status === 'PENDING' ? 'bg-warning/10 text-warning border-warning/20' : 'bg-danger/10 text-danger border-danger/20'}`}>
    {status === 'PENDING' ? 'Pending Approval' : 'Rejected'}
  </span>
);

const MenuButton = ({ onClick, icon: Icon, label, danger = false }: { onClick: () => void; icon: LucideIcon; label: string; danger?: boolean }) => (
  <button
    onClick={onClick}
    className={`w-full h-9 px-3 flex items-center gap-2.5 text-sm hover:bg-bg transition-colors cursor-pointer ${
      danger ? 'text-danger hover:bg-danger/10' : 'text-primary'
    }`}
  >
    <Icon className="w-4 h-4" />
    {label}
  </button>
);

const Modal = ({ title, children, onClose, wide = false }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean }) => (
  <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-md flex items-center justify-center p-3 sm:px-4 transition-all">
    <div className={`glass-panel rounded-2xl ${wide ? 'w-full max-w-2xl' : 'w-full max-w-md'} max-h-[calc(100dvh-1.5rem)] overflow-y-auto`} role="dialog" aria-modal="true" aria-label={title}>
      <div className="h-12 px-5 border-b border-border flex items-center justify-between">
        <h2 className="text-sm font-semibold text-primary truncate pr-4">{title}</h2>
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-md flex items-center justify-center text-muted hover:text-primary hover:bg-bg transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="p-4 sm:p-6">{children}</div>
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
