import { useEffect, useState, FormEvent, ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Folder, Loader2, Trash2, UserPlus, Users, X, Copy } from 'lucide-react';
import api from '../api/axios';
import { useAuthStore } from '../store/authStore';
import Navbar from '../components/Navbar';

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
    } catch (error) {
      console.error('Failed to load members', error);
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
    <div className="min-h-screen bg-bg">
      <Navbar />

      <div className="flex min-h-[calc(100vh-3.5rem)]">
        <aside className="w-72 shrink-0 border-r border-border bg-surface p-4 hidden md:block">
          <Link to="/dashboard" className="w-full h-9 px-2 rounded-md flex items-center gap-2 text-sm text-left text-muted hover:bg-bg">
            <Folder className="w-4 h-4 text-accent" />My Drive
          </Link>
          <Link to="/dashboard?view=shared" className="w-full h-9 mt-1 px-2 rounded-md flex items-center gap-2 text-sm text-left text-muted hover:bg-bg">
            <Users className="w-4 h-4 text-accent" />Shared with me
          </Link>
          <div className="w-full h-9 mt-1 px-2 rounded-md flex items-center gap-2 text-sm text-left bg-bg text-primary">
            <Users className="w-4 h-4 text-accent" />Members
          </div>
        </aside>

        <main className="flex-1 w-full max-w-7xl mx-auto px-6 py-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-5">
            <div>
              <h1 className="text-xl font-semibold text-primary">Organization Members</h1>
              <p className="text-sm text-muted mt-1">Manage who has access to your organization.</p>
            </div>
            {canManage && (
              <button
                onClick={() => { setInviteEmail(''); setInviteLink(''); setInviteModalOpen(true); }}
                className="py-2 px-4 rounded-md bg-accent text-white text-sm font-medium flex items-center gap-2 hover:bg-accent-hover"
              >
                <UserPlus className="w-4 h-4" />
                Invite Member
              </button>
            )}
          </div>

          <section className="bg-surface border border-border rounded-lg overflow-hidden">
            <div className="grid grid-cols-[1fr_120px_150px_100px] gap-3 px-4 py-3 bg-bg text-xs font-medium text-muted uppercase items-center">
              <span>Member</span>
              <span>Role</span>
              <span>Joined</span>
              <span className="text-right">Actions</span>
            </div>

            {loading ? (
              <div className="h-52 flex items-center justify-center text-muted text-sm gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />Loading members
              </div>
            ) : (
              <div className="divide-y divide-border">
                {members.map((member) => (
                  <div key={member.id} className="grid grid-cols-[1fr_120px_150px_100px] gap-3 items-center px-4 py-3 hover:bg-bg">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-primary truncate">{member.user.name}</p>
                      <p className="text-xs text-muted truncate">{member.user.email}</p>
                    </div>
                    
                    {canManage && member.role !== 'OWNER' && (member.role !== 'ADMIN' || currentUserRole === 'OWNER') ? (
                      <select 
                        value={member.role}
                        onChange={(e) => handleRoleChange(member.userId, e.target.value)}
                        className="h-8 px-2 rounded-md border border-border text-sm outline-none bg-transparent focus:border-accent"
                      >
                        <option value="ADMIN">Admin</option>
                        <option value="MEMBER">Member</option>
                      </select>
                    ) : (
                      <span className="text-sm text-muted">{member.role}</span>
                    )}
                    
                    <span className="text-sm text-muted">
                      {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(member.user.createdAt))}
                    </span>
                    
                    <div className="justify-self-end">
                      {canManage && member.role !== 'OWNER' && (member.role !== 'ADMIN' || currentUserRole === 'OWNER') && (
                        <button
                          onClick={() => handleRemove(member.userId, member.user.name)}
                          className="w-8 h-8 rounded-md flex items-center justify-center text-danger hover:bg-surface"
                          title="Remove"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                {invites.map((invite) => (
                  <div key={invite.id} className="grid grid-cols-[1fr_120px_150px_100px] gap-3 items-center px-4 py-3 hover:bg-bg opacity-70">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-primary truncate">{invite.email}</p>
                      <p className="text-xs text-muted truncate">Pending Invite</p>
                    </div>
                    <span className="text-sm text-muted">{invite.role}</span>
                    <span className="text-sm text-muted">-</span>
                    <div className="justify-self-end">
                      {/* Optional: could add cancel invite action here */}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </main>
      </div>

      {inviteModalOpen && (
        <Modal onClose={() => setInviteModalOpen(false)} title="Invite Member">
          {!inviteLink ? (
            <form onSubmit={handleInvite} className="space-y-4">
              <div>
                <label className="block text-sm text-muted mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-border text-sm outline-none focus:border-accent bg-transparent text-primary"
                  placeholder="colleague@example.com"
                />
              </div>
              <div>
                <label className="block text-sm text-muted mb-1">Role</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as 'ADMIN' | 'MEMBER')}
                  className="w-full h-10 px-3 rounded-md border border-border text-sm outline-none focus:border-accent bg-transparent text-primary"
                >
                  <option value="MEMBER">Member</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setInviteModalOpen(false)}
                  className="py-2 px-4 rounded-md border border-border text-sm text-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !inviteEmail.trim()}
                  className="py-2 px-4 rounded-md bg-accent text-white text-sm font-medium disabled:opacity-70 flex items-center gap-2"
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
                  className="flex-1 h-9 px-3 rounded-md border border-border text-sm text-muted bg-transparent"
                />
                <button
                  onClick={copyInviteLink}
                  className="py-2 px-4 rounded-md border border-border text-sm text-primary flex items-center gap-2 hover:bg-bg"
                >
                  <Copy className="w-4 h-4" />Copy
                </button>
              </div>
              <div className="flex justify-end pt-2">
                <button
                  onClick={() => { setInviteModalOpen(false); loadMembers(); }}
                  className="py-2 px-4 rounded-md bg-accent text-white text-sm font-medium"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

const Modal = ({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void; }) => (
  <div className="fixed inset-0 z-40 bg-primary/30 flex items-center justify-center px-4">
    <div className="bg-surface rounded-lg border border-border shadow-xl w-full max-w-md">
      <div className="h-12 px-4 border-b border-border flex items-center justify-between">
        <h2 className="text-sm font-semibold text-primary truncate pr-4">{title}</h2>
        <button onClick={onClose} className="w-8 h-8 rounded-md flex items-center justify-center text-muted hover:bg-bg">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="p-6">{children}</div>
    </div>
  </div>
);
