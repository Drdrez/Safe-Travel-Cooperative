import { useState, useEffect } from 'react';
import { DollarSign, CreditCard, X, Clock, CheckCircle2, Loader2, Search, Download } from 'lucide-react';
import { formatPHP, formatVehicleLine, fromCents } from '@/lib/formatters';
import { formatDate } from '@/lib/date';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useRealtimeRefresh } from '@/lib/useRealtimeRefresh';
import { usePagination, TablePagination } from '@/lib/usePagination';
import { Portal } from './ui/Portal';
import { generateReceiptPdf } from '@/lib/receipt';

type Bill = {
  id: string;
  billing_id_str: string;
  customer_id: string;
  amount_cents: number;
  due_date: string;
  status: string;
  payment_method: string | null;
  reference_id: string | null;
  paid_at: string | null;
  confirmed_at: string | null;
  created_at: string;
  reservation_id: string | null;
  profiles?: { full_name: string | null; email?: string | null; contact_number?: string | null } | null;
  reservations?: {
    reservation_id_str: string | null;
    pickup_location: string | null;
    destination: string | null;
    start_date: string | null;
    end_date: string | null;
    vehicles?: { model: string | null; plate_number: string | null } | null;
  } | null;
};

const downloadReceipt = (b: Bill) => {
  try {
    generateReceiptPdf({
      receiptNumber: b.billing_id_str || b.id.slice(0, 8),
      paidAt: b.paid_at,
      customerName: b.profiles?.full_name || null,
      customerEmail: b.profiles?.email || null,
      customerPhone: b.profiles?.contact_number || null,
      reservationRef: b.reservations?.reservation_id_str || b.reservation_id,
      vehicle: formatVehicleLine(b.reservations?.vehicles ?? undefined),
      pickup: b.reservations?.pickup_location || null,
      destination: b.reservations?.destination || null,
      startDate: b.reservations?.start_date || null,
      endDate: b.reservations?.end_date || null,
      amountCents: b.amount_cents,
      paymentMethod: b.payment_method,
      referenceId: b.reference_id,
    });
    toast.success('Receipt downloaded');
  } catch (err: any) {
    toast.error(`Couldn't generate receipt: ${err?.message || 'unknown error'}`);
  }
};

export function Billing() {
  const [billingList, setBillingList] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'pending confirmation' | 'paid' | 'overdue' | 'cancelled'>('all');
  const [search, setSearch] = useState('');
  const [payingInvoice, setPayingInvoice] = useState<Bill | null>(null);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchData(); }, []);
  useRealtimeRefresh('billings', () => fetchData());

  const fetchData = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('billings')
      .select('id, billing_id_str, customer_id, reservation_id, amount_cents, due_date, status, payment_method, reference_id, paid_at, confirmed_at, created_at, profiles(full_name, email, contact_number), reservations(reservation_id_str, pickup_location, destination, start_date, end_date, vehicles(model, plate_number))')
      .order('created_at', { ascending: false });
    if (error) toast.error(`Couldn't load billings: ${error.message}`);
    if (data) setBillingList(data as any[]);
    setLoading(false);
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingInvoice || !paymentMethod) return;
    setSaving(true);
    const { data: authData } = await supabase.auth.getUser();
    const { error } = await supabase.from('billings').update({
      status: 'Paid',
      payment_method: paymentMethod,
      paid_at: payingInvoice.paid_at || new Date().toISOString(),
      confirmed_at: new Date().toISOString(),
      confirmed_by: authData?.user?.id || null,
    }).eq('id', payingInvoice.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Payment recorded');
    setPayingInvoice(null);
    setPaymentMethod('');
    fetchData();
  };

  const confirmCustomerPayment = async (b: Bill) => {
    if (!confirm(`Confirm ${formatPHP(fromCents(b.amount_cents))} payment from ${b.profiles?.full_name || 'customer'}?`)) return;
    const { data: authData } = await supabase.auth.getUser();
    const { error } = await supabase.from('billings').update({
      status: 'Paid',
      confirmed_at: new Date().toISOString(),
      confirmed_by: authData?.user?.id || null,
    }).eq('id', b.id);
    if (error) { toast.error(error.message); return; }
    toast.success('Customer payment confirmed');
    fetchData();
  };

  const rejectCustomerPayment = async (b: Bill) => {
    if (!confirm(`Reject this payment and send ${b.billing_id_str} back to Pending?`)) return;
    const { error } = await supabase.from('billings').update({
      status: 'Pending',
      payment_method: null,
      reference_id: null,
      paid_at: null,
    }).eq('id', b.id);
    if (error) { toast.error(error.message); return; }
    toast.success('Payment rejected — customer can resubmit');
    fetchData();
  };

  const totalPaid = billingList.filter(b => b.status === 'Paid').reduce((s, b) => s + fromCents(b.amount_cents), 0);
  const totalPending = billingList.filter(b => b.status === 'Pending' || b.status === 'Pending Confirmation').reduce((s, b) => s + fromCents(b.amount_cents), 0);
  const totalOverdue = billingList.filter(b => b.status === 'Overdue').reduce((s, b) => s + fromCents(b.amount_cents), 0);
  const paymentList = billingList.filter(b => b.status === 'Paid');

  const filtered = billingList.filter(b => {
    const s = (b.status || '').toLowerCase();
    const match = filter === 'all' || s === filter;
    if (!match) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (b.billing_id_str || '').toLowerCase().includes(q) ||
      (b.profiles?.full_name || '').toLowerCase().includes(q) ||
      (b.profiles?.email || '').toLowerCase().includes(q)
    );
  });
  const invoicePagination = usePagination(filtered);
  const paymentPagination = usePagination(paymentList);

  const statusBadgeClass = (status: string) => {
    switch (status) {
      case 'Paid': return 'badge-success';
      case 'Pending Confirmation': return 'badge-info';
      case 'Pending': return 'badge-warning';
      case 'Overdue': return 'badge-error';
      case 'Cancelled': return 'badge-default';
      default: return 'badge-default';
    }
  };

  return (
    <div className="space-y-8">
      <div className="page-header">
        <div><h1>Billing & Payments</h1><p>Manage invoices, verify customer payments, and see payment history.</p></div>
      </div>

      <div className="grid-3">
        {[
          { label: 'Total Paid', value: totalPaid, color: 'var(--green-600)', bg: 'var(--green-50)', icon: DollarSign, border: 'var(--green-500)' },
          { label: 'Outstanding', value: totalPending, color: 'var(--brand-gold)', bg: 'var(--brand-gold-light)', icon: CreditCard, border: 'var(--brand-gold)' },
          { label: 'Overdue', value: totalOverdue, color: 'var(--rose-600)', bg: 'var(--rose-50)', icon: DollarSign, border: 'var(--rose-500)' },
        ].map((s) => (
          <div className="card" key={s.label} style={{ borderTop: `4px solid ${s.border}` }}>
            <div className="flex-between">
              <div>
                <p style={{ fontSize: 13, color: 'var(--slate-500)', marginBottom: 4 }}>{s.label}</p>
                <p style={{ fontSize: 24, fontWeight: 700, color: s.color }}>{formatPHP(s.value)}</p>
              </div>
              <div style={{ width: 48, height: 48, borderRadius: 'var(--radius-md)', background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <s.icon size={24} style={{ color: s.color }} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="card-flat">
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--slate-100)' }}>
          <div className="flex-between" style={{ flexWrap: 'wrap', gap: 12 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700 }}>Billing List</h2>
            <div className="flex-start" style={{ gap: 8, flexWrap: 'wrap' }}>
              <div className="filter-tabs">
                {(['all', 'pending confirmation', 'pending', 'paid', 'overdue', 'cancelled'] as const).map(f => (
                  <button key={f} className={cn('filter-tab', filter === f && 'active')} onClick={() => setFilter(f)} style={{ textTransform: 'capitalize' }}>
                    {f}
                  </button>
                ))}
              </div>
              <div className="input-with-icon" style={{ minWidth: 200 }}>
                <Search size={14} />
                <input className="form-input" placeholder="Search invoice / customer" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
            </div>
          </div>
        </div>
        <div className="table-wrapper">
          <table className="data-table">
            <thead><tr><th>Invoice ID</th><th>Customer</th><th>Amount</th><th>Due Date</th><th>Status</th><th>Method</th><th>Action</th></tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 48, color: 'var(--slate-400)' }}>Loading billings…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 48, color: 'var(--slate-400)' }}>No invoices match this filter</td></tr>
              ) : invoicePagination.items.map((b) => (
                <tr key={b.id}>
                  <td style={{ fontWeight: 600 }}>{b.billing_id_str}</td>
                  <td>{b.profiles?.full_name || 'Unknown'}</td>
                  <td style={{ fontWeight: 600 }}>{formatPHP(fromCents(b.amount_cents))}</td>
                  <td>{formatDate(b.due_date)}</td>
                  <td>
                    <span className={cn('badge', statusBadgeClass(b.status))}>
                      {b.status === 'Pending Confirmation' && <Clock size={11} style={{ marginRight: 4 }} />}
                      {b.status}
                    </span>
                  </td>
                  <td>{b.payment_method || '—'}</td>
                  <td>
                    {b.status === 'Pending Confirmation' ? (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-outline btn-sm" style={{ borderColor: 'var(--green-500)', color: 'var(--green-600)' }} onClick={() => confirmCustomerPayment(b)}>
                          <CheckCircle2 size={14} /> Approve
                        </button>
                        <button className="btn btn-outline btn-sm" style={{ borderColor: 'var(--rose-500)', color: 'var(--rose-600)' }} onClick={() => rejectCustomerPayment(b)}>
                          Reject
                        </button>
                      </div>
                    ) : (b.status === 'Pending' || b.status === 'Overdue') ? (
                      <button className="btn btn-outline btn-sm" onClick={() => { setPayingInvoice(b); setPaymentMethod(''); }}>
                        Record Payment
                      </button>
                    ) : b.status === 'Paid' ? (
                      <button className="btn btn-outline btn-sm" onClick={() => downloadReceipt(b)} title="Download official receipt">
                        <Download size={14} /> Receipt
                      </button>
                    ) : <span style={{ color: 'var(--slate-300)' }}>—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <TablePagination pagination={invoicePagination} label="invoices" />
        </div>
      </div>

      <div className="card-flat">
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--slate-100)' }}>
          <h2 style={{ fontSize: 16, fontWeight: 700 }}>Payment History</h2>
        </div>
        <div className="table-wrapper">
          <table className="data-table">
            <thead><tr><th>Payment ID</th><th>Invoice</th><th>Customer</th><th>Amount</th><th>Date</th><th>Method</th><th></th></tr></thead>
            <tbody>
              {paymentList.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 48, color: 'var(--slate-400)' }}>No payments recorded yet</td></tr>
              ) : paymentPagination.items.map((p) => (
                <tr key={p.id}>
                  <td style={{ fontWeight: 600 }}>{p.id.split('-')[0]}-PAY</td>
                  <td>{p.billing_id_str}</td>
                  <td>{p.profiles?.full_name || 'Unknown'}</td>
                  <td style={{ fontWeight: 600 }}>{formatPHP(fromCents(p.amount_cents))}</td>
                  <td>{formatDate(p.paid_at)}</td>
                  <td className="flex-start gap-2"><CreditCard size={14} style={{ color: 'var(--slate-400)' }} /> {p.payment_method || '—'}</td>
                  <td>
                    <button className="btn btn-outline btn-xs" onClick={() => downloadReceipt(p)} title="Download receipt">
                      <Download size={12} /> Receipt
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <TablePagination pagination={paymentPagination} label="payments" />
        </div>
      </div>

      {payingInvoice && (
        <Portal>
          <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setPayingInvoice(null); }}>
            <div className="modal modal-sm">
              <div className="modal-header">
                <h2>Record Payment</h2>
                <button className="modal-close" onClick={() => setPayingInvoice(null)}><X size={20} /></button>
              </div>
              <form onSubmit={handleRecordPayment} className="space-y-4">
                <p style={{ fontSize: 13, color: 'var(--slate-500)' }}>
                  Recording payment of <strong>{formatPHP(fromCents(payingInvoice.amount_cents))}</strong> for {payingInvoice.profiles?.full_name || 'Unknown'}.
                </p>
                <div className="form-group">
                  <label className="form-label">Payment Method</label>
                  <select className="form-select" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} required>
                    <option value="">Select a method</option>
                    <option value="Credit Card">Credit Card</option>
                    <option value="Cash">Cash</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Debit Card">Debit Card</option>
                    <option value="GCash">GCash</option>
                    <option value="Maya">Maya</option>
                  </select>
                </div>
                <button type="submit" className="btn btn-brand btn-lg w-full" disabled={!paymentMethod || saving}>
                  {saving ? <Loader2 size={16} className="animate-spin" /> : 'Confirm Payment'}
                </button>
              </form>
            </div>
          </div>
        </Portal>
      )}
    </div>
  );
}
