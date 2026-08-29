import { useEffect, useState } from 'react';
import { Building2, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import AppShell from '../components/AppShell';
import { OrgMembership } from '../types';

export default function MyOrganizations() {
  const [memberships, setMemberships] = useState<OrgMembership[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  useEffect(() => { void api.get('/auth/me').then((response) => setMemberships(response.data.data.user.orgMemberships || [])).catch(() => setError('Unable to load your organizations.')).finally(() => setLoading(false)); }, []);
  return <AppShell><div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8"><div className="mb-7"><div className="flex gap-2 items-center text-accent"><Building2 className="w-5 h-5" /><span className="text-sm font-medium">Organizations</span></div><h1 className="mt-1 text-2xl font-semibold text-primary">My Organizations</h1><p className="mt-1 text-sm text-muted">Open an organization drive to send and access organization files.</p></div><section className="glass-panel rounded-2xl overflow-hidden">{loading ? <div className="h-48 flex items-center justify-center text-muted"><Loader2 className="w-5 h-5 animate-spin" /></div> : error ? <p className="p-5 text-sm text-danger">{error}</p> : memberships.length === 0 ? <div className="h-48 flex flex-col items-center justify-center text-center"><Building2 className="w-10 h-10 text-accent mb-3" /><p className="font-medium text-primary">You have not joined an organization yet</p><p className="mt-1 text-sm text-muted">Use Discover to search for an organization.</p></div> : <div className="divide-y divide-border/60">{memberships.map((membership) => <Link key={membership.id} to={`/organizations/${membership.orgId}/drive`} className="p-5 flex items-center justify-between gap-4 hover:bg-bg transition-colors"><div className="min-w-0"><p className="text-sm font-medium text-primary truncate">{membership.org.name}</p><p className="mt-1 text-xs text-muted capitalize">{membership.role.toLowerCase()}</p></div><span className="text-sm text-accent">Open drive</span></Link>)}</div>}</section></div></AppShell>;
}
