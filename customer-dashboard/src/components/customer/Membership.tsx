import { useEffect, useMemo, useState } from 'react';
import { Wallet, TrendingUp, HandCoins, FileText, Plus, X, Loader2, AlertCircle, Ban } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';
import { cn } from '../../lib/utils';
import { formatPHP, fromCents, toCents } from '../../lib/utils';
import { useRealtimeRefresh } from '../../lib/useRealtimeRefresh';
import { usePagination, TablePagination } from '../../lib/usePagination';
import { useOpPrefs } from '../../lib/useOpPrefs';

type Member = {
  id: string;
  member_number: string | null;
  membership_date: string;
  membership_status: string;
  share_capital_cents: number;
};

type Contribution = {
  id: string;
  contributed_on: string;
  amount_cents: number;
  kind: string;
  reference: string | null;
  notes: string | null;
};

type Loan = {
  id: string;
  loan_number: string | null;
  principal_cents: number;
  interest_rate_pct: number;
  term_months: number;
  purpose: string | null;
  status: string;
  balance_cents: number;
  created_at: string;
  disbursed_at: string | null;
  decision_notes: string | null;
};

type Payment = {
  id: string;
  loan_id: string;
  paid_on: string;
  amount_cents: number;
  method: string | null;
  reference: string | null;
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

const formatDate = (d: string | null | undefined) => d ? new Date(d).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';

export default function Membership() {
  const [userId, setUserId] = useState<string | null>(null);
  const [member, setMember] = useState<Member | null>(null);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [isApplying, setIsApplying] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ principal_php: '', term_months: '12', purpose: '' });
  const { prefs } = useOpPrefs();
  const acceptMemberApplications = prefs.accept_member_applications;
  const acceptLoanApplications = prefs.accept_loan_applications;

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id || null;
      setUserId(uid);
      if (uid) fetchAll(uid);
      else setLoading(false);
    })();
  }, []);

  useRealtimeRefresh(
    ['cooperative_members', 'member_contributions', 'loan_requests', 'loan_payments'],
    () => { if (userId) fetchAll(userId); },
    { enabled: !!userId },
  );

  const fetchAll = async (uid: string) => {
    setLoading(true);
    const { data: m, error: mErr } = await supabase
      .from('cooperative_members')
      .select('id, member_number, membership_date, membership_status, share_capital_cents')
      .eq('profile_id', uid)
      .maybeSingle();
    if (mErr) toast.error(`Couldn't load membership: ${mErr.message}`);
    setMember((m as Member) || null);

    if (m?.id) {
      const [c, l] = await Promise.all([
        supabase.from('member_contributions').select('*').eq('member_id', m.id).order('contributed_on', { ascending: false }),
        supabase.from('loan_requests').select('*').eq('member_id', m.id).order('created_at', { ascending: false }),
      ]);
      if (c.data) setContributions(c.data as Contribution[]);
      if (l.data) setLoans(l.data as Loan[]);
      const loanIds = (l.data || []).map((x: any) => x.id);
      if (loanIds.length) {
        const { data: p } = await supabase.from('loan_payments').select('*').in('loan_id', loanIds).order('paid_on', { ascending: false });
        if (p) setPayments(p as Payment[]);
      } else {
        setPayments([]);
      }
    } else {
      setContributions([]); setLoans([]); setPayments([]);
    }
    setLoading(false);
  };

  const submitApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!member) return;
    if (!acceptLoanApplications) {
      toast.error('Loan applications are temporarily paused by the cooperative.');
      setIsApplying(false);
      return;
    }
    const principal = Number(form.principal_php);
    if (!principal || principal <= 0) { toast.error('Enter a loan amount'); return; }
    setSaving(true);
    const { error } = await supabase.from('loan_requests').insert([{
      member_id: member.id,
      principal_cents: toCents(principal),
      term_months: Number(form.term_months || 12),
      interest_rate_pct: 2,
      purpose: form.purpose || null,
      status: 'Pending',
    }]);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Loan application submitted. An admin will review shortly.');
    setIsApplying(false);
    setForm({ principal_php: '', term_months: '12', purpose: '' });
    if (userId) fetchAll(userId);
  };

  const totalContributed = contributions.reduce((s, c) => s + c.amount_cents, 0);
  const activeLoans = useMemo(() => loans.filter(l => ['Pending', 'Approved', 'Disbursed', 'Repaying'].includes(l.status)), [loans]);
  const outstanding = activeLoans.reduce((s, l) => s + l.balance_cents, 0);
  const loansPagination = usePagination(loans);
  const contributionsPagination = usePagination(contributions);

  if (loading) {
    return <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 48, color: 'var(--slate-500)' }}><Loader2 size={18} className="animate-spin" /> Loading your membership…</div>;
  }

  if (!member) {
    return (
      <div>
        <h1 style={{ fontSize: 28, fontWeight: 800 }}>Cooperative Membership</h1>
        <p style={{ color: 'var(--slate-500)', marginBottom: 24 }}>Join the Safe Travels Cooperative to contribute share capital and access member loans.</p>
        <div className="card" style={{ padding: 32 }}>
          {acceptMemberApplications ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 16, background: 'var(--amber-50, #fffbeb)', borderRadius: 'var(--radius-md)', marginBottom: 16 }}>
              <AlertCircle size={20} style={{ color: 'var(--amber-500, #f59e0b)' }} />
              <div>
                <p style={{ fontWeight: 700, fontSize: 14 }}>You're not yet a cooperative member</p>
                <p style={{ fontSize: 12, color: 'var(--slate-500)' }}>Visit the cooperative office, or contact us through Support, to be enrolled.</p>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 16, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 'var(--radius-md)', marginBottom: 16 }}>
              <Ban size={20} style={{ color: '#dc2626' }} />
              <div>
                <p style={{ fontWeight: 700, fontSize: 14, color: '#7f1d1d' }}>New member enrollment is currently closed</p>
                <p style={{ fontSize: 12, color: '#991b1b' }}>The cooperative has temporarily paused new applications. Please check back later or contact Support for an update.</p>
              </div>
            </div>
          )}
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Why become a member?</h3>
          <ul style={{ paddingLeft: 20, color: 'var(--slate-600)', fontSize: 13, lineHeight: 1.7 }}>
            <li>Build share capital and participate in cooperative dividends.</li>
            <li>Apply for low-interest member loans.</li>
            <li>Vote on cooperative decisions and general assembly matters.</li>
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800 }}>Cooperative Membership</h1>
          <p style={{ color: 'var(--slate-500)' }}>Member {member.member_number} · Since {formatDate(member.membership_date)}</p>
        </div>
        <span className={cn('badge', STATUS_TONES[member.membership_status] || 'badge-outline')}>{member.membership_status}</span>
      </div>

      <div className="grid-3" style={{ marginBottom: 24 }}>
        <div className="card" style={{ borderTop: '4px solid var(--brand-gold)' }}>
          <div className="flex-between">
            <div><p style={{ fontSize: 12, color: 'var(--slate-500)' }}>Share Capital</p><p style={{ fontSize: 24, fontWeight: 800 }}>{formatPHP(fromCents(member.share_capital_cents))}</p></div>
            <Wallet size={28} style={{ color: 'var(--brand-gold)' }} />
          </div>
        </div>
        <div className="card" style={{ borderTop: '4px solid var(--green-500)' }}>
          <div className="flex-between">
            <div><p style={{ fontSize: 12, color: 'var(--slate-500)' }}>Total Contributions</p><p style={{ fontSize: 24, fontWeight: 800 }}>{formatPHP(fromCents(totalContributed))}</p></div>
            <TrendingUp size={28} style={{ color: 'var(--green-600)' }} />
          </div>
        </div>
        <div className="card" style={{ borderTop: '4px solid var(--indigo-500, #6366f1)' }}>
          <div className="flex-between">
            <div><p style={{ fontSize: 12, color: 'var(--slate-500)' }}>Active Loans Outstanding</p><p style={{ fontSize: 24, fontWeight: 800 }}>{formatPHP(fromCents(outstanding))}</p></div>
            <HandCoins size={28} style={{ color: 'var(--indigo-500, #6366f1)' }} />
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="flex-between mb-4">
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 800 }}>My Loans</h2>
            <p style={{ fontSize: 12, color: 'var(--slate-500)' }}>Applications, approvals, and outstanding balances.</p>
          </div>
          {member.membership_status === 'Active' && (
            acceptLoanApplications ? (
              <button className="btn btn-brand btn-sm" onClick={() => setIsApplying(true)}><Plus size={14} /> Apply for Loan</button>
            ) : (
              <span
                className="badge badge-warning"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}
                title="Loan applications are temporarily paused by the cooperative."
              >
                <Ban size={12} /> Applications paused
              </span>
            )
          )}
        </div>
        {member.membership_status === 'Active' && !acceptLoanApplications && (
          <div
            style={{
              display: 'flex',
              gap: 10,
              alignItems: 'flex-start',
              padding: 12,
              borderRadius: 'var(--radius-md)',
              background: '#fffbeb',
              border: '1px solid #fde68a',
              color: '#78350f',
              marginBottom: 16,
              fontSize: 12,
              lineHeight: 1.5,
            }}
          >
            <Ban size={14} style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <strong>Loan applications are temporarily paused.</strong> You can still see your
              existing loans and make repayments below. New applications will reopen once the
              cooperative resumes the program.
            </div>
          </div>
        )}
        <div className="table-wrapper">
          <table className="data-table">
            <thead><tr><th>Loan #</th><th>Requested</th><th>Principal</th><th>Term</th><th>Balance</th><th>Status</th></tr></thead>
            <tbody>
              {loans.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32, color: 'var(--slate-400)' }}>No loans yet.</td></tr>
              ) : loansPagination.items.map(l => (
                <tr key={l.id}>
                  <td style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>{l.loan_number || '—'}</td>
                  <td style={{ fontSize: 12 }}>{formatDate(l.created_at)}</td>
                  <td style={{ fontSize: 12, fontWeight: 600 }}>{formatPHP(fromCents(l.principal_cents))}</td>
                  <td style={{ fontSize: 12 }}>{l.term_months} mo @ {Number(l.interest_rate_pct).toFixed(2)}%</td>
                  <td style={{ fontSize: 12, fontWeight: 600 }}>{formatPHP(fromCents(l.balance_cents))}</td>
                  <td><span className={cn('badge', STATUS_TONES[l.status] || 'badge-outline')}>{l.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          <TablePagination pagination={loansPagination} label="loans" />
        </div>

        {payments.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Recent repayments</h3>
            <div className="table-wrapper" style={{ maxHeight: 220, overflowY: 'auto' }}>
              <table className="data-table">
                <thead><tr><th>Date</th><th>Loan</th><th>Amount</th><th>Method</th><th>Reference</th></tr></thead>
                <tbody>
                  {payments.map(p => {
                    const loan = loans.find(l => l.id === p.loan_id);
                    return (
                      <tr key={p.id}>
                        <td style={{ fontSize: 12 }}>{formatDate(p.paid_on)}</td>
                        <td style={{ fontSize: 12, fontFamily: 'ui-monospace, monospace' }}>{loan?.loan_number || '—'}</td>
                        <td style={{ fontSize: 12, fontWeight: 600 }}>{formatPHP(fromCents(p.amount_cents))}</td>
                        <td style={{ fontSize: 12 }}>{p.method || '—'}</td>
                        <td style={{ fontSize: 12, color: 'var(--slate-500)' }}>{p.reference || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>Contribution History</h2>
        <p style={{ fontSize: 12, color: 'var(--slate-500)', marginBottom: 12 }}>Dues, share capital, and special assessments recorded by the cooperative office.</p>
        <div className="table-wrapper" style={{ maxHeight: 320, overflowY: 'auto' }}>
          <table className="data-table">
            <thead><tr><th>Date</th><th>Kind</th><th>Amount</th><th>Reference</th><th>Notes</th></tr></thead>
            <tbody>
              {contributions.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: 32, color: 'var(--slate-400)' }}>No contributions recorded.</td></tr>
              ) : contributionsPagination.items.map(c => (
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
          <TablePagination pagination={contributionsPagination} label="contributions" />
        </div>
      </div>

      {isApplying && (
        <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setIsApplying(false); }}>
          <div className="modal modal-md">
            <div className="modal-header">
              <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><FileText size={20} /> Apply for a Loan</h2>
              <button className="modal-close" onClick={() => setIsApplying(false)}><X size={20} /></button>
            </div>
            <form onSubmit={submitApplication} className="space-y-4">
              <div className="grid-2">
                <div className="form-group"><label className="form-label">Amount (₱)</label><input className="form-input" type="number" min="1" step="0.01" value={form.principal_php} onChange={e => setForm({ ...form, principal_php: e.target.value })} required /></div>
                <div className="form-group"><label className="form-label">Term (months)</label><input className="form-input" type="number" min="1" max="120" value={form.term_months} onChange={e => setForm({ ...form, term_months: e.target.value })} required /></div>
              </div>
              <div className="form-group"><label className="form-label">Purpose</label><textarea className="form-input" rows={3} value={form.purpose} onChange={e => setForm({ ...form, purpose: e.target.value })} placeholder="Why are you applying? (e.g. emergency medical, tuition)" /></div>
              <p style={{ fontSize: 12, color: 'var(--slate-500)' }}>Interest rate and final terms are set by the cooperative administrator during review.</p>
              <button type="submit" className="btn btn-brand btn-lg w-full" disabled={saving}>
                {saving ? <Loader2 size={16} className="animate-spin" /> : 'Submit Application'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
