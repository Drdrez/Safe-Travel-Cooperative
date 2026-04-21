import { useState, useEffect } from 'react';
import { formatPHP, fromCents } from '@/lib/formatters';
import { formatDate } from '@/lib/date';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { RefreshCw } from 'lucide-react';
import { useRealtimeRefresh } from '@/lib/useRealtimeRefresh';
import { usePagination, TablePagination } from '@/lib/usePagination';

export function Cancellations() {
  const [cancellationList, setCancellationList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchCancellations(); }, []);
  useRealtimeRefresh(['reservations', 'billings'], () => fetchCancellations());

  const fetchCancellations = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('reservations')
      .select('id, reservation_id_str, start_date, created_at, estimated_cost_cents, profiles!reservations_customer_id_fkey(full_name), vehicles(model, plate_number)')
      .eq('status', 'Cancelled')
      .order('created_at', { ascending: false });

    if (error) toast.error(`Couldn't load cancellations: ${error.message}`);

    if (data) {
      const { data: billings, error: bErr } = await supabase
        .from('billings')
        .select('reservation_id, refund_status')
        .in('reservation_id', data.map(d => d.id));
      if (bErr) toast.error(`Couldn't load billings: ${bErr.message}`);

      const refundMap = new Map<string, string>();
      billings?.forEach((b: any) => {
        if (b.reservation_id && b.refund_status) refundMap.set(b.reservation_id, b.refund_status);
      });

      setCancellationList(data.map(d => ({
        dbId: d.id,
        id: d.reservation_id_str,
        customer: (d.profiles as any)?.full_name || 'Unknown',
        vehicle: d.vehicles ? `${(d.vehicles as any).model} - ${(d.vehicles as any).plate_number}` : 'N/A',
        originalDate: formatDate(d.start_date),
        cancelDate: formatDate(d.created_at),
        reason: 'Customer request',
        refundStatus: refundMap.get(d.id) || 'Pending',
        refundAmountCents: d.estimated_cost_cents || 0
      })));
    }
    setLoading(false);
  };

  const processRefund = async (dbId: string, action: 'Processed' | 'Declined') => {
    const { error } = await supabase
      .from('billings')
      .update({
        refund_status: action,
        refund_processed_at: new Date().toISOString(),
        status: action === 'Processed' ? 'Refunded' : 'Cancelled',
      })
      .eq('reservation_id', dbId);

    if (error) {
      toast.error(`Failed to update refund: ${error.message}`);
      return;
    }

    setCancellationList(prev => prev.map(c => {
      if (c.dbId === dbId) {
        return { ...c, refundStatus: action, refundAmountCents: action === 'Declined' ? 0 : c.refundAmountCents };
      }
      return c;
    }));
    toast.success(`Refund marked as ${action}`);
  };

  const totalCancellations = cancellationList.length;
  const refundsProcessed = cancellationList.filter(c => c.refundStatus === 'Processed').reduce((a, c) => a + c.refundAmountCents, 0);
  const pendingRefunds = cancellationList.filter(c => c.refundStatus === 'Pending').reduce((a, c) => a + c.refundAmountCents, 0);
  const pagination = usePagination(cancellationList);

  return (
    <div className="space-y-8">
      <div className="page-header">
        <div><h1>Cancellations</h1><p>View and manage canceled reservations.</p></div>
        <div className="page-header-actions">
          <button className="btn btn-outline btn-sm" onClick={fetchCancellations} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : undefined} /> Refresh
          </button>
        </div>
      </div>

      <div className="grid-3">
        <div className="card" style={{ borderTop: '4px solid var(--slate-400)' }}>
          <div className="flex-between">
            <div>
              <p style={{ fontSize: 13, color: 'var(--slate-500)', marginBottom: 4 }}>Total Cancellations</p>
              <p style={{ fontSize: 24, fontWeight: 700 }}>{totalCancellations}</p>
            </div>
            <div style={{ width: 48, height: 48, borderRadius: 'var(--radius-md)', background: 'var(--slate-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>✕</div>
          </div>
        </div>
        <div className="card" style={{ borderTop: '4px solid var(--green-500)' }}>
          <div className="flex-between">
            <div>
              <p style={{ fontSize: 13, color: 'var(--slate-500)', marginBottom: 4 }}>Refunds Processed</p>
              <p style={{ fontSize: 24, fontWeight: 700, color: 'var(--green-600)' }}>{formatPHP(fromCents(refundsProcessed))}</p>
            </div>
            <div style={{ width: 48, height: 48, borderRadius: 'var(--radius-md)', background: 'var(--green-50)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: 'var(--green-600)' }}>✓</div>
          </div>
        </div>
        <div className="card" style={{ borderTop: '4px solid var(--brand-gold)' }}>
          <div className="flex-between">
            <div>
              <p style={{ fontSize: 13, color: 'var(--slate-500)', marginBottom: 4 }}>Pending Refunds</p>
              <p style={{ fontSize: 24, fontWeight: 700, color: 'var(--brand-gold)' }}>{formatPHP(fromCents(pendingRefunds))}</p>
            </div>
            <div style={{ width: 48, height: 48, borderRadius: 'var(--radius-md)', background: 'var(--brand-gold-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>⏱</div>
          </div>
        </div>
      </div>

      <div className="card-flat">
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--slate-100)' }}>
          <h2 style={{ fontSize: 16, fontWeight: 700 }}>Cancellation History</h2>
        </div>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr><th>Reservation</th><th>Customer</th><th>Vehicle</th><th>Original Date</th><th>Canceled On</th><th>Refund Status</th><th>Amount</th><th>Action</th></tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: 48, color: 'var(--slate-400)' }}>Loading…</td></tr>
              ) : cancellationList.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: 48, color: 'var(--slate-400)' }}>No cancellations recorded</td></tr>
              ) : pagination.items.map((c) => (
                <tr key={c.dbId}>
                  <td style={{ fontWeight: 600 }}>{c.id}</td>
                  <td>{c.customer}</td>
                  <td>{c.vehicle}</td>
                  <td>{c.originalDate}</td>
                  <td>{c.cancelDate}</td>
                  <td>
                    <span className={cn('badge',
                      c.refundStatus === 'Processed' ? 'badge-success' :
                      c.refundStatus === 'Pending' ? 'badge-warning' : 'badge-error'
                    )}>{c.refundStatus}</span>
                  </td>
                  <td style={{ fontWeight: 600 }}>{formatPHP(fromCents(c.refundAmountCents))}</td>
                  <td>
                    {c.refundStatus === 'Pending' ? (
                      <div className="flex-start gap-2">
                        <button className="btn btn-sm" style={{ background: 'var(--green-50)', color: 'var(--green-700)', fontSize: 12 }} onClick={() => processRefund(c.dbId, 'Processed')}>Approve</button>
                        <button className="btn btn-sm" style={{ background: 'var(--rose-50)', color: 'var(--rose-600)', fontSize: 12 }} onClick={() => processRefund(c.dbId, 'Declined')}>Decline</button>
                      </div>
                    ) : <span style={{ color: 'var(--slate-300)' }}>—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <TablePagination pagination={pagination} label="cancellations" />
        </div>
      </div>
    </div>
  );
}
