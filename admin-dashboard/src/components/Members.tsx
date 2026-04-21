import { useEffect, useMemo, useState } from 'react';
import { UserPlus, Plus, X, Search, Loader2, Wallet, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { formatPHP, fromCents, toCents } from '@/lib/formatters';
import { formatDate } from '@/lib/date';
import { useRealtimeRefresh } from '@/lib/useRealtimeRefresh';
import { usePagination, TablePagination } from '@/lib/usePagination';
import { Portal } from './ui/Portal';

type Member = {
  id: string;
  profile_id: string;
  member_number: string | null;
  membership_date: string;
  membership_status: 'Active' | 'Inactive' | 'Suspended' | 'Terminated' | string;
  share_capital_cents: number;
  notes: string | null;
  created_at: string;
  profiles?: { full_name: string | null; email: string | null; contact_number: string | null } | null;
};

type Contribution = {
  id: string;
  member_id: string;
  contributed_on: string;
  amount_cents: number;
  kind: 'Monthly Dues' | 'Share Capital' | 'Special Assessment' | 'Other' | string;
  reference: string | null;
  notes: string | null;
};

type CandidateProfile = {
  id: string;
  full_name: string | null;
  email: string | null;
};

const STATUS_TONES: Record<string, string> = {
  Active: 'badge-success',
  Inactive: 'badge-default',
  Suspended: 'badge-warning',
  Terminated: 'badge-error',
};

const CONTRIBUTION_KINDS = ['Monthly Dues', 'Share Capital', 'Special Assessment', 'Other'] as const;
const MEMBERSHIP_STATUSES = ['Active', 'Inactive', 'Suspended', 'Terminated'] as const;

export function Members() {
  const [members, setMembers] = useState<Member[]>([]);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [candidateProfiles, setCandidateProfiles] = useState<CandidateProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | typeof MEMBERSHIP_STATUSES[number]>('all');
  const [detailMember, setDetailMember] = useState<Member | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [addForm, setAddForm] = useState({ profile_id: '', share_capital_php: '0', notes: '' });
  const [contribForm, setContribForm] = useState({
    contributed_on: new Date().toISOString().slice(0, 10),
    amount_php: '',
    kind: 'Monthly Dues' as typeof CONTRIBUTION_KINDS[number],
    reference: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchAll(); }, []);
  useRealtimeRefresh(['cooperative_members', 'member_contributions'], () => fetchAll());

  const fetchAll = async () => {
    setLoading(true);
    const [m, c, p] = await Promise.all([
      supabase.from('cooperative_members').select('*, profiles:profile_id(full_name, email, contact_number)').order('membership_date', { ascending: false }),
      supabase.from('member_contributions').select('*').order('contributed_on', { ascending: false }),
      supabase.from('profiles').select('id, full_name, email').eq('role', 'customer'),
    ]);
    if (m.error) toast.error(`Couldn't load members: ${m.error.message}`);
    else setMembers((m.data || []) as any as Member[]);
    if (c.error) toast.error(`Couldn't load contributions: ${c.error.message}`);
    else setContributions((c.data || []) as Contribution[]);
    if (p.error) toast.error(`Couldn't load profiles: ${p.error.message}`);
    else setCandidateProfiles((p.data || []) as CandidateProfile[]);
    setLoading(false);
  };

  const filteredMembers = useMemo(() => {
    return members.filter(m => {
      if (statusFilter !== 'all' && m.membership_status !== statusFilter) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        (m.member_number || '').toLowerCase().includes(q) ||
        (m.profiles?.full_name || '').toLowerCase().includes(q) ||
        (m.profiles?.email || '').toLowerCase().includes(q)
      );
    });
  }, [members, search, statusFilter]);
  const pagination = usePagination(filteredMembers);

  const availableProfiles = useMemo(() => {
    const taken = new Set(members.map(m => m.profile_id));
    return candidateProfiles.filter(p => !taken.has(p.id));
  }, [candidateProfiles, members]);

  const totalShareCapital = members.reduce((s, m) => s + m.share_capital_cents, 0);
  const totalContributions = contributions.reduce((s, c) => s + c.amount_cents, 0);

  const enrollMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.profile_id) { toast.error('Pick a customer profile'); return; }
    setSaving(true);
    const { error } = await supabase.from('cooperative_members').insert([{
      profile_id: addForm.profile_id,
      share_capital_cents: toCents(Number(addForm.share_capital_php || 0)),
      notes: addForm.notes || null,
    }]);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Member enrolled');
    setIsAdding(false);
    setAddForm({ profile_id: '', share_capital_php: '0', notes: '' });
    fetchAll();
  };

  const updateStatus = async (member: Member, status: string) => {
    const { error } = await supabase.from('cooperative_members').update({ membership_status: status }).eq('id', member.id);
    if (error) { toast.error(error.message); return; }
    toast.success('Membership updated');
    fetchAll();
  };

  const addContribution = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detailMember) return;
    if (!contribForm.amount_php || Number(contribForm.amount_php) <= 0) { toast.error('Enter a contribution amount'); return; }
    setSaving(true);
    const { data: authData } = await supabase.auth.getUser();
    const { error } = await supabase.from('member_contributions').insert([{
      member_id: detailMember.id,
      contributed_on: contribForm.contributed_on,
      amount_cents: toCents(Number(contribForm.amount_php)),
      kind: contribForm.kind,
      reference: contribForm.reference || null,
      notes: contribForm.notes || null,
      recorded_by: authData.user?.id || null,
    }]);

    if (!error && contribForm.kind === 'Share Capital') {
      const next = detailMember.share_capital_cents + toCents(Number(contribForm.amount_php));
      await supabase.from('cooperative_members').update({ share_capital_cents: next }).eq('id', detailMember.id);
    }

    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Contribution recorded');
    setContribForm({
      contributed_on: new Date().toISOString().slice(0, 10),
      amount_php: '',
      kind: 'Monthly Dues',
      reference: '',
      notes: '',
    });
    fetchAll();
  };

  const memberContributions = detailMember ? contributions.filter(c => c.member_id === detailMember.id) : [];
  const memberTotal = memberContributions.reduce((s, c) => s + c.amount_cents, 0);

  return (
    <div className="space-y-8">
      <div className="page-header">
        <div><h1>Cooperative Members</h1><p>Enroll customers as coop members, track contributions and share capital.</p></div>
        <button className="btn btn-brand btn-sm" onClick={() => setIsAdding(true)}><UserPlus size={16} /> Enroll Member</button>
      </div>

      <div className="grid-3">
        <div className="card" style={{ borderTop: '4px solid var(--brand-gold)' }}>
          <div className="flex-between">
            <div><p style={{ fontSize: 13, color: 'var(--slate-500)' }}>Total Members</p><p style={{ fontSize: 24, fontWeight: 800 }}>{members.length}</p></div>
            <Wallet size={28} style={{ color: 'var(--brand-gold)' }} />
          </div>
        </div>
        <div className="card" style={{ borderTop: '4px solid var(--indigo-500, #6366f1)' }}>
          <div className="flex-between">
            <div><p style={{ fontSize: 13, color: 'var(--slate-500)' }}>Share Capital</p><p style={{ fontSize: 24, fontWeight: 800 }}>{formatPHP(fromCents(totalShareCapital))}</p></div>
            <TrendingUp size={28} style={{ color: 'var(--indigo-500, #6366f1)' }} />
          </div>
        </div>
        <div className="card" style={{ borderTop: '4px solid var(--green-500)' }}>
          <div className="flex-between">
            <div><p style={{ fontSize: 13, color: 'var(--slate-500)' }}>Contributions Collected</p><p style={{ fontSize: 24, fontWeight: 800 }}>{formatPHP(fromCents(totalContributions))}</p></div>
            <TrendingUp size={28} style={{ color: 'var(--green-600)' }} />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="flex-between mb-6" style={{ flexWrap: 'wrap', gap: 12 }}>
          <div className="search-bar"><Search className="search-icon" /><input placeholder="Search by name, number, email…" value={search} onChange={e => setSearch(e.target.value)} /></div>
          <div className="filter-tabs">
            {(['all', ...MEMBERSHIP_STATUSES] as const).map(s => (
              <button key={s} className={cn('filter-tab', statusFilter === s && 'active')} onClick={() => setStatusFilter(s)}>{s}</button>
            ))}
          </div>
        </div>

        <div className="table-wrapper">
          <table className="data-table">
            <thead><tr><th>Member #</th><th>Name</th><th>Since</th><th>Share Capital</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 48, color: 'var(--slate-400)' }}>Loading…</td></tr>
              ) : filteredMembers.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 48, color: 'var(--slate-400)' }}>No members match.</td></tr>
              ) : pagination.items.map(m => (
                <tr key={m.id}>
                  <td style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>{m.member_number || '—'}</td>
                  <td>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{m.profiles?.full_name || '—'}</div>
                    <div style={{ fontSize: 11, color: 'var(--slate-400)' }}>{m.profiles?.email || '—'}</div>
                  </td>
                  <td style={{ fontSize: 12 }}>{formatDate(m.membership_date)}</td>
                  <td style={{ fontSize: 12, fontWeight: 600 }}>{formatPHP(fromCents(m.share_capital_cents))}</td>
                  <td><span className={cn('badge', STATUS_TONES[m.membership_status] || 'badge-outline')}>{m.membership_status}</span></td>
                  <td>
                    <button className="btn btn-outline btn-xs" onClick={() => setDetailMember(m)}>Open</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <TablePagination pagination={pagination} label="members" />
        </div>
      </div>

      {/* Enroll modal */}
      {isAdding && (
        <Portal>
          <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setIsAdding(false); }}>
            <div className="modal modal-md">
              <div className="modal-header">
                <h2>Enroll New Cooperative Member</h2>
                <button className="modal-close" onClick={() => setIsAdding(false)}><X size={20} /></button>
              </div>
              <form onSubmit={enrollMember} className="space-y-4">
                <div className="form-group">
                  <label className="form-label">Customer profile</label>
                  <select className="form-input" value={addForm.profile_id} onChange={e => setAddForm({ ...addForm, profile_id: e.target.value })} required>
                    <option value="">Select a customer…</option>
                    {availableProfiles.map(p => <option key={p.id} value={p.id}>{p.full_name || 'Unnamed'} — {p.email}</option>)}
                  </select>
                  {availableProfiles.length === 0 && <p style={{ fontSize: 11, color: 'var(--slate-400)', marginTop: 4 }}>All customer profiles are already enrolled.</p>}
                </div>
                <div className="form-group"><label className="form-label">Initial Share Capital (₱)</label><input className="form-input" type="number" min="0" step="0.01" value={addForm.share_capital_php} onChange={e => setAddForm({ ...addForm, share_capital_php: e.target.value })} /></div>
                <div className="form-group"><label className="form-label">Notes</label><input className="form-input" value={addForm.notes} onChange={e => setAddForm({ ...addForm, notes: e.target.value })} placeholder="Optional" /></div>
                <button type="submit" className="btn btn-brand btn-lg w-full" disabled={saving}>
                  {saving ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : 'Enroll Member'}
                </button>
              </form>
            </div>
          </div>
        </Portal>
      )}

      {/* Detail modal */}
      {detailMember && (
        <Portal>
          <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setDetailMember(null); }}>
            <div className="modal modal-lg">
              <div className="modal-header">
                <h2>{detailMember.profiles?.full_name || 'Member'} — {detailMember.member_number}</h2>
                <button className="modal-close" onClick={() => setDetailMember(null)}><X size={20} /></button>
              </div>

              <div className="grid-3" style={{ marginBottom: 16 }}>
                <div><p style={{ fontSize: 11, color: 'var(--slate-400)' }}>Member since</p><p style={{ fontWeight: 600 }}>{formatDate(detailMember.membership_date)}</p></div>
                <div><p style={{ fontSize: 11, color: 'var(--slate-400)' }}>Share capital</p><p style={{ fontWeight: 600 }}>{formatPHP(fromCents(detailMember.share_capital_cents))}</p></div>
                <div>
                  <p style={{ fontSize: 11, color: 'var(--slate-400)' }}>Status</p>
                  <select className="form-input" value={detailMember.membership_status} onChange={(e) => updateStatus(detailMember, e.target.value)}>
                    {MEMBERSHIP_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ padding: 16, background: 'var(--slate-50)', borderRadius: 'var(--radius-md)', marginBottom: 16 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Record contribution</h3>
                <form onSubmit={addContribution} className="grid-3" style={{ gap: 12, alignItems: 'end' }}>
                  <div className="form-group"><label className="form-label">Date</label><input className="form-input" type="date" value={contribForm.contributed_on} onChange={e => setContribForm({ ...contribForm, contributed_on: e.target.value })} required /></div>
                  <div className="form-group"><label className="form-label">Amount (₱)</label><input className="form-input" type="number" min="0.01" step="0.01" value={contribForm.amount_php} onChange={e => setContribForm({ ...contribForm, amount_php: e.target.value })} required /></div>
                  <div className="form-group">
                    <label className="form-label">Kind</label>
                    <select className="form-input" value={contribForm.kind} onChange={e => setContribForm({ ...contribForm, kind: e.target.value as any })}>
                      {CONTRIBUTION_KINDS.map(k => <option key={k} value={k}>{k}</option>)}
                    </select>
                  </div>
                  <div className="form-group" style={{ gridColumn: 'span 2' }}><label className="form-label">Reference</label><input className="form-input" value={contribForm.reference} onChange={e => setContribForm({ ...contribForm, reference: e.target.value })} placeholder="OR number, bank slip, etc." /></div>
                  <button type="submit" className="btn btn-brand btn-md" disabled={saving}>
                    {saving ? 'Saving…' : <><Plus size={14} /> Add</>}
                  </button>
                </form>
              </div>

              <div className="flex-between mb-2">
                <h3 style={{ fontSize: 14, fontWeight: 700 }}>Contribution history</h3>
                <span style={{ fontSize: 13, fontWeight: 700 }}>Total {formatPHP(fromCents(memberTotal))}</span>
              </div>
              <div className="table-wrapper" style={{ maxHeight: 260, overflowY: 'auto' }}>
                <table className="data-table">
                  <thead><tr><th>Date</th><th>Kind</th><th>Amount</th><th>Reference</th><th>Notes</th></tr></thead>
                  <tbody>
                    {memberContributions.length === 0 ? (
                      <tr><td colSpan={5} style={{ textAlign: 'center', padding: 24, color: 'var(--slate-400)' }}>No contributions yet.</td></tr>
                    ) : memberContributions.map(c => (
                      <tr key={c.id}>
                        <td style={{ fontSize: 12 }}>{formatDate(c.contributed_on)}</td>
                        <td style={{ fontSize: 12 }}><span className="badge badge-outline">{c.kind}</span></td>
                        <td style={{ fontSize: 12, fontWeight: 600 }}>{formatPHP(fromCents(c.amount_cents))}</td>
                        <td style={{ fontSize: 12, color: 'var(--slate-500)' }}>{c.reference || '—'}</td>
                        <td style={{ fontSize: 12, color: 'var(--slate-500)' }}>{c.notes || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </Portal>
      )}
    </div>
  );
}
