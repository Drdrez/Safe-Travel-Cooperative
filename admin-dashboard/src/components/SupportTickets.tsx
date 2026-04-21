import { useEffect, useState } from 'react';
import { MessageSquare, Send, X, Loader2, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { formatDateTime } from '@/lib/date';
import { useRealtimeRefresh } from '@/lib/useRealtimeRefresh';
import { usePagination, TablePagination } from '@/lib/usePagination';
import { Portal } from './ui/Portal';

type Ticket = {
  id: string;
  customer_id: string;
  subject: string;
  message: string;
  status: 'Open' | 'In Progress' | 'Resolved' | 'Closed' | string;
  admin_reply: string | null;
  replied_by: string | null;
  replied_at: string | null;
  created_at: string;
  reservation_id: string | null;
  profiles?: { full_name: string; email: string } | null;
  reservations?: {
    reservation_id_str: string | null;
    pickup_location: string | null;
    destination: string | null;
    status: string | null;
  } | null;
};

const STATUS_OPTIONS: Array<Ticket['status']> = ['Open', 'In Progress', 'Resolved', 'Closed'];

const statusBadge = (s: string) => {
  switch (s) {
    case 'Open': return 'badge-warning';
    case 'In Progress': return 'badge-info';
    case 'Resolved': return 'badge-success';
    case 'Closed': return 'badge-default';
    default: return 'badge-default';
  }
};

export function SupportTickets() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [active, setActive] = useState<Ticket | null>(null);
  const [reply, setReply] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchTickets(); }, []);
  useRealtimeRefresh('support_tickets', () => fetchTickets());

  const fetchTickets = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('support_tickets')
      .select('id, customer_id, subject, message, status, admin_reply, replied_by, replied_at, created_at, reservation_id, profiles!support_tickets_customer_id_fkey(full_name, email), reservations(reservation_id_str, pickup_location, destination, status)')
      .order('created_at', { ascending: false });
    if (error) {
      toast.error(`Couldn't load tickets: ${error.message}. Did you run the SQL migration?`);
    } else if (data) {
      setTickets(data as any[]);
    }
    setLoading(false);
  };

  const openTicket = (t: Ticket) => {
    setActive(t);
    setReply(t.admin_reply || '');
  };

  const saveReply = async (status?: Ticket['status']) => {
    if (!active) return;
    const { data: authData } = await supabase.auth.getUser();
    setSaving(true);
    const patch: Record<string, unknown> = {
      admin_reply: reply.trim() || null,
      replied_by: authData?.user?.id || null,
      replied_at: reply.trim() ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    };
    if (status) patch.status = status;
    const { error } = await supabase.from('support_tickets').update(patch).eq('id', active.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Ticket updated');
    setActive(null);
    setReply('');
    fetchTickets();
  };

  const filtered = tickets.filter(t =>
    statusFilter === 'all' || t.status.toLowerCase() === statusFilter
  );
  const pagination = usePagination(filtered);

  return (
    <div className="space-y-8">
      <div className="page-header">
        <div><h1>Support</h1><p>Customer messages routed to the cooperative.</p></div>
        <div className="page-header-actions">
          <button className="btn btn-outline btn-sm" onClick={fetchTickets} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : undefined} /> Refresh
          </button>
        </div>
      </div>

      <div className="card">
        <div className="flex-between mb-4" style={{ flexWrap: 'wrap', gap: 12 }}>
          <div className="filter-tabs">
            {['All', 'Open', 'In Progress', 'Resolved', 'Closed'].map(f => (
              <button key={f} onClick={() => setStatusFilter(f.toLowerCase())}
                className={cn('filter-tab', statusFilter === f.toLowerCase() && 'active')}>{f}</button>
            ))}
          </div>
          <span style={{ fontSize: 12, color: 'var(--slate-400)' }}>{filtered.length} / {tickets.length}</span>
        </div>

        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Subject</th>
                <th>Received</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: 48, color: 'var(--slate-400)' }}>Loading tickets…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: 48, color: 'var(--slate-400)' }}>
                  <MessageSquare size={36} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                  <p style={{ fontWeight: 700 }}>No tickets match this filter</p>
                </td></tr>
              ) : pagination.items.map(t => (
                <tr key={t.id} style={{ cursor: 'pointer' }} onClick={() => openTicket(t)}>
                  <td>
                    <div>
                      <p style={{ fontWeight: 700, fontSize: 13 }}>{t.profiles?.full_name || 'Unknown'}</p>
                      <p style={{ fontSize: 11, color: 'var(--slate-400)' }}>{t.profiles?.email || ''}</p>
                    </div>
                  </td>
                  <td>
                    <div>
                      <p style={{ fontWeight: 600, fontSize: 13 }}>{t.subject}</p>
                      {t.reservations?.reservation_id_str && (
                        <p style={{ fontSize: 11, color: 'var(--indigo-600)', fontWeight: 700, marginTop: 2 }}>
                          Trip {t.reservations.reservation_id_str}
                        </p>
                      )}
                    </div>
                  </td>
                  <td style={{ fontSize: 12 }}>{formatDateTime(t.created_at)}</td>
                  <td><span className={cn('badge', statusBadge(t.status))}>{t.status}</span></td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="btn btn-outline btn-sm" onClick={(e) => { e.stopPropagation(); openTicket(t); }}>Open</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <TablePagination pagination={pagination} label="tickets" />
        </div>
      </div>

      {active && (
        <Portal>
          <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setActive(null); }}>
            <div className="modal modal-md">
              <div className="modal-header">
                <h2>Ticket</h2>
                <button className="modal-close" onClick={() => setActive(null)}><X size={20} /></button>
              </div>
              <div className="space-y-4">
                <div style={{ padding: 16, background: 'var(--slate-50)', borderRadius: 'var(--radius-md)' }}>
                  <p style={{ fontSize: 11, color: 'var(--slate-400)', fontWeight: 700, textTransform: 'uppercase' }}>From</p>
                  <p style={{ fontWeight: 700 }}>{active.profiles?.full_name || 'Unknown'} — <span style={{ fontWeight: 500, color: 'var(--slate-500)' }}>{active.profiles?.email}</span></p>
                  <p style={{ fontSize: 12, color: 'var(--slate-400)', marginTop: 4 }}>{formatDateTime(active.created_at)}</p>
                </div>
                <div>
                  <p className="form-label">Subject</p>
                  <p style={{ fontWeight: 700 }}>{active.subject}</p>
                </div>
                {active.reservations?.reservation_id_str && (
                  <div style={{ padding: 14, border: '1px solid var(--indigo-100)', background: 'var(--indigo-50)', borderRadius: 'var(--radius-md)' }}>
                    <p style={{ fontSize: 11, color: 'var(--indigo-600)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Related trip</p>
                    <p style={{ fontWeight: 700, fontSize: 13, marginTop: 4 }}>
                      {active.reservations.reservation_id_str}
                      {active.reservations.status && (
                        <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--slate-500)' }}>· {active.reservations.status}</span>
                      )}
                    </p>
                    {(active.reservations.pickup_location || active.reservations.destination) && (
                      <p style={{ fontSize: 12, color: 'var(--slate-600)', marginTop: 2 }}>
                        {active.reservations.pickup_location || '—'} → {active.reservations.destination || '—'}
                      </p>
                    )}
                  </div>
                )}
                <div>
                  <p className="form-label">Message</p>
                  <p style={{ padding: 14, background: 'var(--slate-50)', borderRadius: 'var(--radius-md)', fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{active.message}</p>
                </div>
                <div className="form-group">
                  <label className="form-label">Your Reply</label>
                  <textarea
                    className="form-textarea"
                    rows={4}
                    value={reply}
                    onChange={e => setReply(e.target.value)}
                    placeholder="Write a response to the customer…"
                  />
                </div>
                <div className="modal-footer" style={{ gap: 8 }}>
                  <select
                    className="form-select"
                    style={{ width: 180 }}
                    value={active.status}
                    onChange={e => setActive({ ...active, status: e.target.value as any })}
                  >
                    {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <button className="btn btn-outline btn-md" onClick={() => setActive(null)}>Cancel</button>
                  <button className="btn btn-brand btn-md" onClick={() => saveReply(active.status)} disabled={saving}>
                    {saving ? <Loader2 size={16} className="animate-spin" /> : <><Send size={14} /> Save & Reply</>}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </Portal>
      )}
    </div>
  );
}
