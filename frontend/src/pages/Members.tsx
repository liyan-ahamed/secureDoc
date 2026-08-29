import { useEffect, useState, FormEvent, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Trash2, UserPlus, X, Copy } from 'lucide-react';
import api from '../api/axios';
import { useAuthStore } from '../store/authStore';
import AppShell from '../components/AppShell';

type OrgMember = {
  id: string;
  userId: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
  user: {
    id: string;
    name: string;
    email: string;
    createdAt: string;
  };
};

type Invite = {
  id: string;
  email: string;
  role: 'ADMIN' | 'MEMBER';
  createdAt: string;
};

export default function Members() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'ADMIN' | 'MEMBER'>('MEMBER');
  const [inviteLink, setInviteLink] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const orgId = user?.orgMemberships?.[0]?.orgId;
  const currentUserRole = user?.orgMemberships?.[0]?.role;
  const canManage = currentUserRole === 'OWNER' || currentUserRole === 'ADMIN';

  useEffect(() => {
    if (!orgId) {
      navigate('/dashboard', { replace: true });
      return;
    }
    loadMembers();
  }, [orgId]);

  const loadMembers = async () => {
    try {
      const response = await api.get(`/orgs/${orgId}`);
      setMembers(response.data.data.org.members);
      setInvites(response.data.data.org.invites || []);
    } catch {
      setErrorMessage('We could not load organization members. Please refresh and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async (e: FormEvent) => {
    e.preventDefault();
    if (!orgId || !inviteEmail.trim()) return;

    setSubmitting(true);
    setInviteLink('');
    try {
      const response = await api.post(`/orgs/${orgId}/invite`, {
        email: inviteEmail,
        role: inviteRole
      });
      
      if (response.data.data.inviteLink) {
        const fullLink = `${window.location.origin}${response.data.data.inviteLink}`;
        setInviteLink(fullLink);
      } else {
        // User was added directly
        setInviteModalOpen(false);
        setInviteEmail('');
        loadMembers();
      }
    } catch (error: any) {
      alert(error.response?.data?.error?.message || 'Failed to invite user');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRoleChange = async (targetUserId: string, newRole: string) => {
    if (!orgId || !canManage) return;
    try {
      await api.patch(`/orgs/${orgId}/members/${targetUserId}`, { role: newRole });
      loadMembers();
    } catch (error: any) {
      alert(error.response?.data?.error?.message || 'Failed to update role');
    }
  };

  const handleRemove = async (targetUserId: string, name: string) => {
    if (!orgId || !canManage) return;
    if (!window.confirm(`Are you sure you want to remove ${name} from the organization?`)) return;

    try {
      await api.delete(`/orgs/${orgId}/members/${targetUserId}`);
      loadMembers();
    } catch (error: any) {
      alert(error.response?.data?.error?.message || 'Failed to remove member');
    }
  };

  const copyInviteLink = async () => {
    if (!inviteLink) return;
    await navigator.clipboard?.writeText(inviteLink);
    alert('Link copied to clipboard!');
  };

  return (
    <AppShell>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 sm:py-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-5">
            <div>
              <h1 className="text-xl font-semibold text-primary">Organization Members</h1>
              <p className="text-sm text-muted mt-1">Manage who has access to your organization.</p>
            </div>
            {canManage && (
              <button
                onClick={() => { setInviteEmail(''); setInviteLink(''); setInviteModalOpen(true); }}
                className="py-2 px-4 rounded-md bg-accent text-bg text-sm font-medium flex items-center gap-2 hover:bg-accent-hover transition-colors cursor-pointer shadow-sm"
              >
                <UserPlus className="w-4 h-4" />
                Invite Member
              </button>
            )}
          </div>

          <section className="glass-panel rounded-2xl overflow-hidden">
            <div className="hidden sm:grid sm:grid-cols-[1fr_120px_150px_100px] gap-3 px-4 py-3 bg-bg border-b border-border text-xs font-medium text-muted uppercase tracking-wider items-center">
              <span>Member</span>
              <span>Role</span>
              <span>Joined</span>
              <span className="text-right">Actions</span>
            </div>

            {loading ? (
              <div className="h-52 flex items-center justify-center text-muted text-sm gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-accent" />
                Loading members
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {errorMessage ? <p className="p-4 text-sm text-danger">{errorMessage}</p> : members.map((member) => (
                  <div key={member.id} className="grid grid-cols-1 sm:grid-cols-[1fr_120px_150px_100px] gap-3 items-center px-4 py-4 hover:bg-bg transition-colors">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-primary truncate">{member.user.name}</p>
                      <p className="text-xs text-muted truncate">{member.user.email}</p>
                    </div>
                    
                    {canManage && member.role !== 'OWNER' && (member.role !== 'ADMIN' || currentUserRole === 'OWNER') ? (
                      <select 
                        value={member.role}
                        onChange={(e) => handleRoleChange(member.userId, e.target.value)}
                        className="h-8 px-2 rounded-md border border-border text-xs outline-none bg-bg text-primary focus:border-accent cursor-pointer"
                      >
                        <option value="ADMIN">Admin</option>
                        <option value="MEMBER">Member</option>
                      </select>
                    ) : (
                      <span className="text-sm text-muted">{member.role}</span>
                    )}
                    
                    <span className="text-sm text-muted"><span className="sm:hidden font-medium text-primary mr-2">Joined:</span>
                      {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(member.user.createdAt))}
                    </span>
                    
                    <div className="justify-self-end">
                      {canManage && member.role !== 'OWNER' && (member.role !== 'ADMIN' || currentUserRole === 'OWNER') && (
                        <button aria-label={`Remove ${member.user.name}`}
                          onClick={() => handleRemove(member.userId, member.user.name)}
                          className="touch-target rounded-md flex items-center justify-center text-danger hover:bg-danger/10 transition-colors cursor-pointer"
                          title="Remove member"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                {invites.map((invite) => (
                  <div key={invite.id} className="grid grid-cols-1 sm:grid-cols-[1fr_120px_150px_100px] gap-3 items-center px-4 py-4 hover:bg-bg opacity-75 transition-colors">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-primary truncate">{invite.email}</p>
                      <span className="inline-block mt-0.5 text-[11px] font-medium px-1.5 py-0.5 rounded bg-accent/10 text-accent border border-accent/20">
                        Pending Invite
                      </span>
                    </div>
                    <span className="text-sm text-muted">{invite.role}</span>
                    <span className="text-sm text-muted">-</span>
                    <div className="justify-self-end"></div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

      {inviteModalOpen && (
        <Modal onClose={() => setInviteModalOpen(false)} title="Invite Member">
          {!inviteLink ? (
            <form onSubmit={handleInvite} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-primary mb-1.5">Email Address</label>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-border text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent bg-bg text-primary placeholder-muted"
                  placeholder="colleague@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-primary mb-1.5">Role</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as 'ADMIN' | 'MEMBER')}
                  className="w-full h-10 px-3 rounded-md border border-border text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent bg-bg text-primary"
                >
                  <option value="MEMBER">Member</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setInviteModalOpen(false)}
                  className="py-2 px-4 rounded-md border border-border text-sm text-muted hover:text-primary hover:bg-bg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !inviteEmail.trim()}
                  className="py-2 px-4 rounded-md bg-accent text-bg text-sm font-medium disabled:opacity-70 flex items-center gap-2 hover:bg-accent-hover transition-colors cursor-pointer shadow-sm"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Send Invite
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-primary">An invitation has been created. Share this link with the user:</p>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={inviteLink}
                  className="flex-1 h-9 px-3 rounded-md border border-border text-sm text-muted bg-bg"
                />
                <button
                  onClick={copyInviteLink}
                  className="py-1.5 px-3 rounded-md border border-border text-sm text-primary flex items-center gap-2 hover:bg-bg transition-colors cursor-pointer"
                >
                  <Copy className="w-4 h-4" />Copy
                </button>
              </div>
              <div className="flex justify-end pt-2">
                <button
                  onClick={() => { setInviteModalOpen(false); loadMembers(); }}
                  className="py-2 px-4 rounded-md bg-accent text-bg text-sm font-medium hover:bg-accent-hover transition-colors cursor-pointer shadow-sm"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </AppShell>
  );
}

const Modal = ({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void; }) => (
  <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-md flex items-center justify-center p-3 sm:px-4 transition-all">
    <div className="glass-panel rounded-2xl w-full max-w-md max-h-[calc(100dvh-1.5rem)] overflow-y-auto" role="dialog" aria-modal="true" aria-label={title}>
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
