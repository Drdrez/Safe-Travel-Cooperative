import { useEffect, useMemo, useState } from 'react';
import { Plus, X, Search, CheckCircle2, XCircle, DollarSign, Loader2, HandCoins } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { formatPHP, fromCents, toCents } from '@/lib/formatters';
import { formatDate } from '@/lib/date';
import { useRealtimeRefresh } from '@/lib/useRealtimeRefresh';
import { usePagination, TablePagination } from '@/lib/usePagination';
import { Portal } from './ui/Portal';

type Loan = {
  id: string;
  loan_number: string | null;
  member_id: string;
  principal_cents: number;
  interest_rate_pct: number;
  term_months: number;
  purpose: string | null;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Disbursed' | 'Repaying' | 'Closed' | 'Defaulted' | 'Cancelled' | string;
  decided_at: string | null;
  decision_notes: string | null;
  disbursed_at: string | null;
  disbursed_amount_cents: number | null;
  balance_cents: number;
  created_at: string;
  cooperative_members?: {
    member_number: string | null;
    profile_id: string | null;
    profiles?: { full_name: string | null; email: string | null } | null;
  } | null;
};

type Payment = {
  id: string;
  loan_id: string;
  paid_on: string;
  amount_cents: number;
  method: string | null;
  reference: string | null;
  notes: string | null;
};

type MemberLite = {
  id: string;
  member_number: string | null;
  profile_id: string;
  profiles?: { full_name: string | null } | null;
};

const STATUS_TONES: Record<string, string> = {
  Pending: 'badge-warning',
  Approved: 'badge-info',
  Rejected: 'badge-error',
  Disbursed: 'badge-info',
  Repaying: 'badge-info',
  Closed: 'badge-success',
  Defaulted: 'badge-error',
  Cancelled: 'badge-default',
};

const STATUSES = ['all', 'Pending', 'Approved', 'Disbursed', 'Repaying', 'Closed', 'Rejected', 'Defaulted', 'Cancelled'] as const;

function buildSchedule(principalCents: number, annualPct: number, months: number, start = new Date()) {
  if (!months || months <= 0 || !principalCents) return [];
  const monthlyRate = annualPct / 100 / 12;
  const totalInterest = Math.round(principalCents * monthlyRate * months);
  const total = principalCents + totalInterest;
  const per = Math.round(total / months);
  const rows: { no: number; due: string; principal: number; interest: number; amount: number }[] = [];
  for (let i = 1; i <= months; i++) {
    const d = new Date(start);
    d.setMonth(d.getMonth() + i);
    rows.push({
      no: i,
      due: d.toISOString().slice(0, 10),
      principal: Math.round(principalCents / months),
      interest: Math.round(totalInterest / months),
      amount: per,
    });
  }
  return rows;
}

export function Loans() {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [members, setMembers] = useState<MemberLite[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<typeof STATUSES[number]>('all');
  const [detailLoan, setDetailLoan] = useState<Loan | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [createForm, setCreateForm] = useState({
    member_id: '',
    principal_php: '',
    interest_rate_pct: '2',
    term_months: '12',
    purpose: '',
  });
  const [decisionNotes, setDecisionNotes] = useState('');
  const [payForm, setPayForm] = useState({ paid_on: new Date().toISOString().slice(0, 10), amount_php: '', method: 'Cash', reference: '' });

  useEffect(() => { fetchAll(); }, []);
  useRealtimeRefresh(['loan_requests', 'loan_payments', 'cooperative_members'], () => fetchAll());

  const fetchAll = async () => {
    setLoading(true);
    const [l, m, p] = await Promise.all([
      supabase
        .from('loan_requests')
        .select('*, cooperative_members:member_id(member_number, profile_id, profiles:profile_id(full_name, email))')
        .order('created_at', { ascending: false }),
      supabase.from('cooperative_members').select('id, member_number, profile_id, profiles:profile_id(full_name)').eq('membership_status', 'Active'),
      supabase.from('loan_payments').select('*').order('paid_on', { ascending: false }),
    ]);
    if (l.error) toast.error(`Couldn't load loans: ${l.error.message}`);
    else setLoans((l.data || []) as any as Loan[]);
    if (m.error) toast.error(`Couldn't load members: ${m.error.message}`);
    else setMembers((m.data || []) as any as MemberLite[]);
    if (p.error) toast.error(`Couldn't load payments: ${p.error.message}`);
    else setPayments((p.data || []) as Payment[]);
    setLoading(false);
  };

  const filtered = useMemo(() => {
    return loans.filter(l => {
      if (statusFilter !== 'all' && l.status !== statusFilter) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        (l.loan_number || '').toLowerCase().includes(q) ||
        (l.cooperative_members?.profiles?.full_name || '').toLowerCase().includes(q) ||
        (l.cooperative_members?.member_number || '').toLowerCase().includes(q)
      );
    });
  }, [loans, search, statusFilter]);
  const pagination = usePagination(filtered);

  const pendingCount = loans.filter(l => l.status === 'Pending').length;
  const activeCount = loans.filter(l => l.status === 'Disbursed' || l.status === 'Repaying' || l.status === 'Approved').length;
  const outstanding = loans.filter(l => l.status !== 'Closed' && l.status !== 'Rejected' && l.status !== 'Cancelled').reduce((s, l) => s + l.balance_cents, 0);
  const disbursedTotal = loans.reduce((s, l) => s + (l.disbursed_amount_cents || 0), 0);

  const createLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.member_id) { toast.error('Pick a member'); return; }
    const principal = Number(createForm.principal_php);
    if (!principal || principal <= 0) { toast.error('Enter a principal amount'); return; }
    setSaving(true);
    const { error } = await supabase.from('loan_requests').insert([{
      member_id: createForm.member_id,
      principal_cents: toCents(principal),
      interest_rate_pct: Number(createForm.interest_rate_pct || 0),
      term_months: Number(createForm.term_months || 12),
      purpose: createForm.purpose || null,
    }]);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Loan request created (Pending)');
    setIsCreating(false);
    setCreateForm({ member_id: '', principal_php: '', interest_rate_pct: '2', term_months: '12', purpose: '' });
    fetchAll();
  };

  const decide = async (loan: Loan, status: 'Approved' | 'Rejected' | 'Cancelled') => {
    const { data: authData } = await supabase.auth.getUser();
    const { error } = await supabase.from('loan_requests').update({
      status,
      decided_at: new Date().toISOString(),
      decided_by: authData.user?.id || null,
      decision_notes: decisionNotes || null,
    }).eq('id', loan.id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Loan ${status.toLowerCase()}`);
    setDecisionNotes('');
    setDetailLoan(null);
    fetchAll();
  };

  const disburse = async (loan: Loan) => {
    if (!confirm(`Disburse ${formatPHP(fromCents(loan.principal_cents))} to this member?`)) return;
    const { error } = await supabase.from('loan_requests').update({
      status: 'Disbursed',
      disbursed_at: new Date().toISOString(),
      disbursed_amount_cents: loan.principal_cents,
    }).eq('id', loan.id);
    if (error) { toast.error(error.message); return; }
    toast.success('Loan disbursed');
    fetchAll();
  };

  const recordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detailLoan) return;
    const amt = Number(payForm.amount_php);
    if (!amt || amt <= 0) { toast.error('Enter a payment amount'); return; }
    setSaving(true);
    const { data: authData } = await supabase.auth.getUser();
    const { error } = await supabase.from('loan_payments').insert([{
      loan_id: detailLoan.id,
      paid_on: payForm.paid_on,
      amount_cents: toCents(amt),
      method: payForm.method,
      reference: payForm.reference || null,
      recorded_by: authData.user?.id || null,
    }]);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Payment recorded');
    setPayForm({ paid_on: new Date().toISOString().slice(0, 10), amount_php: '', method: 'Cash', reference: '' });
    fetchAll();
    const { data } = await supabase.from('loan_requests').select('*, cooperative_members:member_id(member_number, profile_id, profiles:profile_id(full_name, email))').eq('id', detailLoan.id).single();
    if (data) setDetailLoan(data as any);
  };

  const loanPayments = detailLoan ? payments.filter(p => p.loan_id === detailLoan.id) : [];
  const schedulePreview = detailLoan ? buildSchedule(
    detailLoan.disbursed_amount_cents || detailLoan.principal_cents,
    Number(detailLoan.interest_rate_pct),
    detailLoan.term_months,
    new Date(detailLoan.disbursed_at || detailLoan.created_at),
  ) : [];

  return (
    <div className="space-y-8">
      <div className="page-header">
        <div><h1>Loan Management</h1><p>Review member loan applications, approve or reject, and record repayments.</p></div>
        <button className="btn btn-brand btn-sm" onClick={() => setIsCreating(true)}><Plus size={16} /> Log Loan Request</button>
      </div>

      <div className="grid-3">
        <div className="card"><p style={{ fontSize: 13, color: 'var(--slate-500)' }}>Pending Review</p><p style={{ fontSize: 24, fontWeight: 800, color: pendingCount ? 'var(--brand-gold)' : 'var(--slate-700)' }}>{pendingCount}</p></div>
        <div className="card"><p style={{ fontSize: 13, color: 'var(--slate-500)' }}>Active Loans</p><p style={{ fontSize: 24, fontWeight: 800 }}>{activeCount}</p></div>
        <div className="card"><p style={{ fontSize: 13, color: 'var(--slate-500)' }}>Outstanding Balance</p><p style={{ fontSize: 24, fontWeight: 800 }}>{formatPHP(fromCents(outstanding))}</p><p style={{ fontSize: 11, color: 'var(--slate-400)' }}>of {formatPHP(fromCents(disbursedTotal))} disbursed</p></div>
      </div>

      <div className="card">
        <div className="flex-between mb-6" style={{ flexWrap: 'wrap', gap: 12 }}>
          <div className="search-bar"><Search className="search-icon" /><input placeholder="Search by loan #, member…" value={search} onChange={e => setSearch(e.target.value)} /></div>
          <div className="filter-tabs">
            {STATUSES.map(s => (
              <button key={s} className={cn('filter-tab', statusFilter === s && 'active')} onClick={() => setStatusFilter(s)}>{s}</button>
            ))}
          </div>
        </div>

        <div className="table-wrapper">
          <table className="data-table">
            <thead><tr><th>Loan #</th><th>Member</th><th>Principal</th><th>Term</th><th>Balance</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 48, color: 'var(--slate-400)' }}>Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 48, color: 'var(--slate-400)' }}>No loans match.</td></tr>
              ) : pagination.items.map(l => (
                <tr key={l.id}>
                  <td style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>{l.loan_number || '—'}</td>
                  <td>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{l.cooperative_members?.profiles?.full_name || '—'}</div>
                    <div style={{ fontSize: 11, color: 'var(--slate-400)' }}>{l.cooperative_members?.member_number || '—'}</div>
                  </td>
                  <td style={{ fontSize: 12, fontWeight: 600 }}>{formatPHP(fromCents(l.principal_cents))}</td>
                  <td style={{ fontSize: 12 }}>{l.term_months} mo @ {Number(l.interest_rate_pct).toFixed(2)}%</td>
                  <td style={{ fontSize: 12, fontWeight: 600 }}>{formatPHP(fromCents(l.balance_cents))}</td>
                  <td><span className={cn('badge', STATUS_TONES[l.status] || 'badge-outline')}>{l.status}</span></td>
                  <td><button className="btn btn-outline btn-xs" onClick={() => setDetailLoan(l)}>Open</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <TablePagination pagination={pagination} label="loans" />
        </div>
      </div>

      {/* Create request modal */}
      {isCreating && (
        <Portal>
          <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setIsCreating(false); }}>
            <div className="modal modal-md">
              <div className="modal-header">
                <h2>Log Loan Request</h2>
                <button className="modal-close" onClick={() => setIsCreating(false)}><X size={20} /></button>
              </div>
              <form onSubmit={createLoan} className="space-y-4">
                <div className="form-group">
                  <label className="form-label">Member</label>
                  <select className="form-input" value={createForm.member_id} onChange={e => setCreateForm({ ...createForm, member_id: e.target.value })} required>
                    <option value="">Pick an active member…</option>
                    {members.map(m => <option key={m.id} value={m.id}>{m.profiles?.full_name || 'Unnamed'} — {m.member_number}</option>)}
                  </select>
                </div>
                <div className="grid-2">
                  <div className="form-group"><label className="form-label">Principal (₱)</label><input className="form-input" type="number" min="1" step="0.01" value={createForm.principal_php} onChange={e => setCreateForm({ ...createForm, principal_php: e.target.value })} required /></div>
                  <div className="form-group"><label className="form-label">Term (months)</label><input className="form-input" type="number" min="1" max="120" value={createForm.term_months} onChange={e => setCreateForm({ ...createForm, term_months: e.target.value })} required /></div>
                </div>
                <div className="form-group"><label className="form-label">Interest Rate (% / yr)</label><input className="form-input" type="number" min="0" step="0.01" value={createForm.interest_rate_pct} onChange={e => setCreateForm({ ...createForm, interest_rate_pct: e.target.value })} /></div>
                <div className="form-group"><label className="form-label">Purpose</label><input className="form-input" value={createForm.purpose} onChange={e => setCreateForm({ ...createForm, purpose: e.target.value })} placeholder="e.g. Emergency medical" /></div>
                <button type="submit" className="btn btn-brand btn-lg w-full" disabled={saving}>
                  {saving ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : 'Create Loan Request'}
                </button>
              </form>
            </div>
          </div>
        </Portal>
      )}

      {/* Detail modal */}
      {detailLoan && (
        <Portal>
          <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setDetailLoan(null); }}>
            <div className="modal modal-lg">
              <div className="modal-header">
                <h2>{detailLoan.loan_number} — {detailLoan.cooperative_members?.profiles?.full_name || 'Member'}</h2>
                <button className="modal-close" onClick={() => setDetailLoan(null)}><X size={20} /></button>
              </div>

              <div className="grid-3" style={{ marginBottom: 16 }}>
                <div><p style={{ fontSize: 11, color: 'var(--slate-400)' }}>Principal</p><p style={{ fontWeight: 700, fontSize: 16 }}>{formatPHP(fromCents(detailLoan.principal_cents))}</p></div>
                <div><p style={{ fontSize: 11, color: 'var(--slate-400)' }}>Term / Rate</p><p style={{ fontWeight: 600 }}>{detailLoan.term_months} mo @ {Number(detailLoan.interest_rate_pct).toFixed(2)}%</p></div>
                <div><p style={{ fontSize: 11, color: 'var(--slate-400)' }}>Outstanding</p><p style={{ fontWeight: 700, fontSize: 16 }}>{formatPHP(fromCents(detailLoan.balance_cents))}</p></div>
              </div>

              <div style={{ padding: 12, background: 'var(--slate-50)', borderRadius: 'var(--radius-md)', marginBottom: 16 }}>
                <p style={{ fontSize: 12, color: 'var(--slate-500)' }}>Purpose: <span style={{ color: 'var(--slate-800)' }}>{detailLoan.purpose || '—'}</span></p>
                <p style={{ fontSize: 12, color: 'var(--slate-500)' }}>Requested: <span style={{ color: 'var(--slate-800)' }}>{formatDate(detailLoan.created_at)}</span></p>
                {detailLoan.decided_at && <p style={{ fontSize: 12, color: 'var(--slate-500)' }}>Decided: <span style={{ color: 'var(--slate-800)' }}>{formatDate(detailLoan.decided_at)}</span></p>}
                {detailLoan.decision_notes && <p style={{ fontSize: 12, color: 'var(--slate-500)' }}>Notes: <span style={{ color: 'var(--slate-800)' }}>{detailLoan.decision_notes}</span></p>}
              </div>

              {detailLoan.status === 'Pending' && (
                <div style={{ padding: 12, background: 'var(--amber-50, #fffbeb)', borderRadius: 'var(--radius-md)', marginBottom: 16 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Decision</h3>
                  <textarea className="form-input" rows={2} placeholder="Decision notes (optional)" value={decisionNotes} onChange={e => setDecisionNotes(e.target.value)} style={{ marginBottom: 8 }} />
                  <div className="flex-start gap-2">
                    <button className="btn btn-primary btn-md" onClick={() => decide(detailLoan, 'Approved')}><CheckCircle2 size={14} /> Approve</button>
                    <button className="btn btn-outline btn-md" onClick={() => decide(detailLoan, 'Rejected')} style={{ color: 'var(--rose-600)' }}><XCircle size={14} /> Reject</button>
                  </div>
                </div>
              )}

              {detailLoan.status === 'Approved' && (
                <div className="flex-start gap-2 mb-4">
                  <button className="btn btn-primary btn-md" onClick={() => disburse(detailLoan)}><HandCoins size={14} /> Mark Disbursed</button>
                </div>
              )}

              {(detailLoan.status === 'Disbursed' || detailLoan.status === 'Repaying') && (
                <div style={{ padding: 12, background: 'var(--slate-50)', borderRadius: 'var(--radius-md)', marginBottom: 16 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Record repayment</h3>
                  <form onSubmit={recordPayment} className="grid-3" style={{ gap: 12, alignItems: 'end' }}>
                    <div className="form-group"><label className="form-label">Paid on</label><input className="form-input" type="date" value={payForm.paid_on} onChange={e => setPayForm({ ...payForm, paid_on: e.target.value })} required /></div>
                    <div className="form-group"><label className="form-label">Amount (₱)</label><input className="form-input" type="number" min="0.01" step="0.01" value={payForm.amount_php} onChange={e => setPayForm({ ...payForm, amount_php: e.target.value })} required /></div>
                    <div className="form-group">
                      <label className="form-label">Method</label>
                      <select className="form-input" value={payForm.method} onChange={e => setPayForm({ ...payForm, method: e.target.value })}>
                        <option>Cash</option><option>GCash</option><option>Bank Transfer</option><option>Salary Deduction</option>
                      </select>
                    </div>
                    <div className="form-group" style={{ gridColumn: 'span 2' }}><label className="form-label">Reference</label><input className="form-input" value={payForm.reference} onChange={e => setPayForm({ ...payForm, reference: e.target.value })} placeholder="OR #, txn ref" /></div>
                    <button type="submit" className="btn btn-brand btn-md" disabled={saving}><DollarSign size={14} /> Record</button>
                  </form>
                </div>
              )}

              <div className="grid-2" style={{ gap: 16, alignItems: 'start' }}>
                <div>
                  <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Amortization preview</h3>
                  <div className="table-wrapper" style={{ maxHeight: 280, overflowY: 'auto' }}>
                    <table className="data-table">
                      <thead><tr><th>#</th><th>Due</th><th>Principal</th><th>Interest</th><th>Amount</th></tr></thead>
                      <tbody>
                        {schedulePreview.length === 0 ? (
                          <tr><td colSpan={5} style={{ textAlign: 'center', padding: 16, color: 'var(--slate-400)' }}>—</td></tr>
                        ) : schedulePreview.map(r => (
                          <tr key={r.no}>
                            <td style={{ fontSize: 12 }}>{r.no}</td>
                            <td style={{ fontSize: 12 }}>{formatDate(r.due)}</td>
                            <td style={{ fontSize: 12 }}>{formatPHP(fromCents(r.principal))}</td>
                            <td style={{ fontSize: 12 }}>{formatPHP(fromCents(r.interest))}</td>
                            <td style={{ fontSize: 12, fontWeight: 600 }}>{formatPHP(fromCents(r.amount))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p style={{ fontSize: 11, color: 'var(--slate-400)', marginTop: 4 }}>Straight-line schedule for reference only.</p>
                </div>
                <div>
                  <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Repayments</h3>
                  <div className="table-wrapper" style={{ maxHeight: 280, overflowY: 'auto' }}>
                    <table className="data-table">
                      <thead><tr><th>Date</th><th>Amount</th><th>Method</th><th>Reference</th></tr></thead>
                      <tbody>
                        {loanPayments.length === 0 ? (
                          <tr><td colSpan={4} style={{ textAlign: 'center', padding: 16, color: 'var(--slate-400)' }}>No payments yet.</td></tr>
                        ) : loanPayments.map(p => (
                          <tr key={p.id}>
                            <td style={{ fontSize: 12 }}>{formatDate(p.paid_on)}</td>
                            <td style={{ fontSize: 12, fontWeight: 600 }}>{formatPHP(fromCents(p.amount_cents))}</td>
                            <td style={{ fontSize: 12 }}>{p.method || '—'}</td>
                            <td style={{ fontSize: 12, color: 'var(--slate-500)' }}>{p.reference || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Portal>
      )}
    </div>
  );
}
