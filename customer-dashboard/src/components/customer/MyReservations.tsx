import { useState, useEffect } from 'react';
import { Calendar, X, Loader2, Clock, Trash2, ArrowRight, RefreshCw, AlertTriangle, MessageSquare, Send, Gauge } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router';
import { supabase } from '../../lib/supabase';
import { formatDateTime, hoursUntil } from '../../lib/date';
import { formatPHP, fromCents } from '../../lib/utils';
import { useRealtimeRefresh } from '../../lib/useRealtimeRefresh';
import { usePagination, TablePagination } from '../../lib/usePagination';
import { Portal } from '../ui/Portal';

interface Reservation {
  id: string;
  reservation_id_str: string;
  pickup_location: string;
  destination: string;
  start_date: string;
  end_date: string;
  status: string;
  created_at: string;
  estimated_cost_cents?: number | null;
  vehicles?: { vehicle_type: string; model?: string; plate_number?: string } | null;
  customer_special_requests?: string | null;
  dispatch_odometer_km?: number | null;
  dispatch_fuel_level?: string | null;
  dispatch_condition_notes?: string | null;
  dispatch_recorded_at?: string | null;
  return_odometer_km?: number | null;
  return_fuel_level?: string | null;
  return_condition_notes?: string | null;
  return_recorded_at?: string | null;
  km_driven?: number | null;
}

type ThreadMessage = {
  id: string;
  body: string;
  is_staff: boolean;
  created_at: string;
  profiles?: { full_name: string | null } | null;
};

const DEFAULT_CANCEL_WINDOW_HOURS = 2;
const DEFAULT_CANCEL_FEE_PCT = 10;

export default function MyReservations() {
  const navigate = useNavigate();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [reservationToCancel, setReservationToCancel] = useState<Reservation | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [cancelWindowHours, setCancelWindowHours] = useState<number>(DEFAULT_CANCEL_WINDOW_HOURS);
  const [cancelFeePct, setCancelFeePct] = useState<number>(DEFAULT_CANCEL_FEE_PCT);
  const [enforceCancellationFee, setEnforceCancellationFee] = useState<boolean>(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [threadMessages, setThreadMessages] = useState<ThreadMessage[]>([]);
  const [msgDraft, setMsgDraft] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setUserId(data.user?.id ?? null);
    })();
    fetchReservations();
    fetchCancellationPolicy();
  }, []);

  useRealtimeRefresh(
    'reservations',
    () => fetchReservations(true),
    { filter: userId ? `customer_id=eq.${userId}` : undefined, enabled: !!userId },
  );

  const selectedId = selectedReservation?.id;
  const loadThread = async (rid: string) => {
    const { data, error } = await supabase
      .from('reservation_messages')
      .select('id, body, is_staff, created_at, profiles!reservation_messages_author_id_fkey(full_name)')
      .eq('reservation_id', rid)
      .order('created_at', { ascending: true });
    if (error) {
      toast.error(error.message);
      setThreadMessages([]);
      return;
    }
    setThreadMessages((data as unknown as ThreadMessage[]) ?? []);
  };

  useEffect(() => {
    if (!selectedId) {
      setThreadMessages([]);
      setMsgDraft('');
      return;
    }
    void loadThread(selectedId);
  }, [selectedId]);

  useRealtimeRefresh(
    'reservation_messages',
    () => {
      if (selectedId) void loadThread(selectedId);
    },
    {
      filter: selectedId ? `reservation_id=eq.${selectedId}` : undefined,
      enabled: !!selectedId,
    },
  );

  useEffect(() => {
    const id = selectedReservation?.id;
    if (!id) return;
    const row = reservations.find((r) => r.id === id);
    if (row) setSelectedReservation((prev) => (prev?.id === id ? row : prev));
  }, [reservations, selectedReservation?.id]);

  const handleSendThreadMessage = async () => {
    const body = msgDraft.trim();
    if (!body || !userId || !selectedReservation) return;
    setSendingMsg(true);
    const { error } = await supabase.from('reservation_messages').insert({
      reservation_id: selectedReservation.id,
      author_id: userId,
      body,
      is_staff: false,
    });
    setSendingMsg(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setMsgDraft('');
    await loadThread(selectedReservation.id);
  };

  const fetchCancellationPolicy = async () => {
    const { data } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'op_prefs')
      .single();
    const prefs = (data?.value ?? {}) as any;
    if (Number.isFinite(Number(prefs.cancellation_window_hours))) {
      setCancelWindowHours(Number(prefs.cancellation_window_hours));
    }
    if (Number.isFinite(Number(prefs.cancellation_fee_pct))) {
      setCancelFeePct(Number(prefs.cancellation_fee_pct));
    }
    if (typeof prefs.enforce_cancellation_fee === 'boolean') {
      setEnforceCancellationFee(prefs.enforce_cancellation_fee);
    }
  };

  const fetchReservations = async (silent = false) => {
    if (!silent) setLoading(true);

    const { data: authData } = await supabase.auth.getUser();
    if (authData.user) {
      const { data, error } = await supabase
        .from('reservations')
        .select(`*, vehicles(vehicle_type, model, plate_number)`)
        .eq('customer_id', authData.user.id)
        .order('created_at', { ascending: false });

      if (data) setReservations(data as any[]);
      if (error) toast.error('Could not fetch reservations: ' + error.message);
    }
    setLoading(false);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchReservations(true);
    setIsRefreshing(false);
  };

  const computeCancellationFeeCents = (res: Reservation): number => {
    if (!enforceCancellationFee) return 0;
    const hrs = hoursUntil(res.start_date);
    if (hrs >= cancelWindowHours) return 0;
    const base = Number(res.estimated_cost_cents || 0);
    const pct = Math.max(0, Math.min(100, cancelFeePct));
    return Math.round(base * (pct / 100));
  };

  const handleCancelReservation = async () => {
    if (!reservationToCancel) return;
    setIsCancelling(true);

    const feeCents = computeCancellationFeeCents(reservationToCancel);

    const { error } = await supabase
      .from('reservations')
      .update({ status: 'Cancelled' })
      .eq('id', reservationToCancel.id);

    if (error) {
      toast.error(error.message);
      setIsCancelling(false);
      return;
    }

    if (feeCents > 0) {
      const { error: billingErr } = await supabase
        .from('billings')
        .update({ amount_cents: feeCents, status: 'Pending' })
        .eq('reservation_id', reservationToCancel.id)
        .in('status', ['Pending', 'Pending Confirmation']);
      if (billingErr) {
        toast.warning(`Trip cancelled, but invoice fee update failed: ${billingErr.message}`);
      }
    } else {
      const { error: billingErr } = await supabase
        .from('billings')
        .update({ status: 'Cancelled' })
        .eq('reservation_id', reservationToCancel.id)
        .in('status', ['Pending', 'Pending Confirmation']);
      if (billingErr) {
        toast.warning(`Trip cancelled, but invoice sync failed: ${billingErr.message}`);
      }
    }

    await fetchReservations();
    setIsCancelling(false);
    setReservationToCancel(null);
    toast.success(
      feeCents > 0
        ? `Trip cancelled. A cancellation fee of ${formatPHP(fromCents(feeCents))} has been added to your invoice.`
        : 'Reservation cancelled successfully'
    );
  };

  const pagination = usePagination(reservations);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="page-header">
        <div>
          <h1>My Trips</h1>
          <p>Upcoming journeys and previous trips with Safe Travel Cooperative.</p>
        </div>
        <div className="page-header-actions">
           <button className="btn btn-outline" onClick={handleRefresh} disabled={isRefreshing} title="Refresh">
              <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : undefined} />
           </button>
           <button className="btn btn-brand" onClick={() => navigate('/customer/make-reservation')}>
              Book New Trip <ArrowRight size={18} />
           </button>
        </div>
      </div>

      <div className="data-card">
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Trip Plan</th>
                <th>Schedule</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Management</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: 80 }}><Loader2 className="animate-spin" style={{ margin: '0 auto' }} /></td></tr>
              ) : reservations.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: 100 }}>
                   <Calendar size={64} style={{ color: 'var(--slate-200)', marginBottom: 24, margin: '0 auto' }} />
                   <h3 style={{ color: 'var(--slate-400)', marginBottom: 12 }}>No reservations yet</h3>
                   <p style={{ color: 'var(--slate-400)', fontSize: 14 }}>Your travel history will appear here once you book a trip.</p>
                </td></tr>
              ) : pagination.items.map((res) => (
                <tr key={res.id}>
                  <td><span style={{ fontWeight: 800, color: 'var(--slate-900)' }}>{res.reservation_id_str}</span></td>
                  <td>
                    <div className="space-y-1">
                        <div className="flex-start" style={{ gap: 8 }}>
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--brand-gold)' }}></div>
                            <span style={{ fontWeight: 700 }}>{res.pickup_location}</span>
                        </div>
                        <div className="flex-start" style={{ gap: 8 }}>
                            <div style={{ width: 8, height: 8, borderRadius: '50%', border: '2px solid var(--slate-200)' }}></div>
                            <span style={{ color: 'var(--slate-500)', fontWeight: 500 }}>{res.destination}</span>
                        </div>
                    </div>
                  </td>
                  <td>
                    <div className="flex-start" style={{ gap: 8, color: 'var(--slate-600)' }}>
                       <Clock size={16} />
                       <span style={{ fontWeight: 600 }}>{formatDateTime(res.start_date)}</span>
                    </div>
                  </td>
                  <td>
                    <span className={`status-badge status-badge-${res.status.toLowerCase()}`}>
                       {res.status}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div className="flex-start" style={{ justifyContent: 'flex-end', gap: 8 }}>
                       <button onClick={() => setSelectedReservation(res)} className="btn btn-outline btn-sm">Details</button>
                       {['Pending', 'Confirmed'].includes(res.status) && (
                         <button onClick={() => setReservationToCancel(res)} className="btn btn-outline btn-sm" style={{ color: '#ef4444' }}><Trash2 size={14} /></button>
                       )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <TablePagination pagination={pagination} label="reservations" />
        </div>
      </div>

      {/* Details Modal */}
      {selectedReservation && (
        <Portal>
          <div className="modal-backdrop">
             <div className="modal modal-xl" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
                <div className="flex-between" style={{ marginBottom: 24 }}>
                   <h3>Trip Summary</h3>
                   <button onClick={() => setSelectedReservation(null)} style={{ color: 'var(--slate-400)' }}><X size={20}/></button>
                </div>
                <div className="space-y-6">
                   <div style={{ padding: 24, background: 'var(--slate-50)', borderRadius: 16, border: '1px solid var(--slate-100)' }}>
                      <p style={{ fontSize: 11, fontWeight: 800, color: 'var(--slate-400)', textTransform: 'uppercase', marginBottom: 8 }}>Unique Trip Identifier</p>
                      <h2 style={{ fontSize: 24, fontWeight: 800 }}>{selectedReservation.reservation_id_str}</h2>
                   </div>

                   {selectedReservation.customer_special_requests && (
                     <div style={{ padding: 16, background: 'var(--slate-50)', borderRadius: 12, border: '1px solid var(--slate-100)' }}>
                        <p style={{ fontSize: 11, fontWeight: 800, color: 'var(--slate-400)', textTransform: 'uppercase', marginBottom: 8 }}>Your note to dispatch</p>
                        <p style={{ fontSize: 13, lineHeight: 1.55, margin: 0 }}>{selectedReservation.customer_special_requests}</p>
                     </div>
                   )}
                   
                   <div className="customer-modal-grid-2">
                      <div>
                          <p style={{ fontSize: 11, fontWeight: 800, color: 'var(--slate-400)', textTransform: 'uppercase', marginBottom: 6 }}>Departure</p>
                          <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--slate-900)' }}>{selectedReservation.pickup_location}</p>
                      </div>
                      <div>
                          <p style={{ fontSize: 11, fontWeight: 800, color: 'var(--slate-400)', textTransform: 'uppercase', marginBottom: 6 }}>Arrival</p>
                          <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--slate-900)' }}>{selectedReservation.destination}</p>
                      </div>
                   </div>

                   <div className="customer-modal-grid-2">
                      <div>
                          <p style={{ fontSize: 11, fontWeight: 800, color: 'var(--slate-400)', textTransform: 'uppercase', marginBottom: 6 }}>Pickup</p>
                          <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--slate-900)' }}>{formatDateTime(selectedReservation.start_date)}</p>
                      </div>
                      <div>
                          <p style={{ fontSize: 11, fontWeight: 800, color: 'var(--slate-400)', textTransform: 'uppercase', marginBottom: 6 }}>Return</p>
                          <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--slate-900)' }}>{formatDateTime(selectedReservation.end_date)}</p>
                      </div>
                      <div>
                          <p style={{ fontSize: 11, fontWeight: 800, color: 'var(--slate-400)', textTransform: 'uppercase', marginBottom: 6 }}>Vehicle</p>
                          <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--slate-900)' }}>
                            {selectedReservation.vehicles
                              ? `${selectedReservation.vehicles.model || selectedReservation.vehicles.vehicle_type || 'Vehicle'}${selectedReservation.vehicles.plate_number ? ' — ' + selectedReservation.vehicles.plate_number : ''}`
                              : 'To be assigned'}
                          </p>
                      </div>
                      <div>
                          <p style={{ fontSize: 11, fontWeight: 800, color: 'var(--slate-400)', textTransform: 'uppercase', marginBottom: 6 }}>Current Status</p>
                          <span className={`status-badge status-badge-${selectedReservation.status.toLowerCase().replace(/\s+/g, '-')}`}>{selectedReservation.status}</span>
                      </div>
                   </div>

                   {(selectedReservation.dispatch_odometer_km != null ||
                     selectedReservation.dispatch_fuel_level ||
                     selectedReservation.dispatch_condition_notes) && (
                     <div style={{ padding: 16, borderRadius: 12, border: '1px solid var(--slate-200)' }}>
                        <p style={{ fontSize: 12, fontWeight: 800, marginBottom: 12 }}>Handover (dispatch)</p>
                        <div className="customer-modal-grid-2" style={{ gap: 12 }}>
                           {selectedReservation.dispatch_odometer_km != null && (
                             <div>
                               <p style={{ fontSize: 10, color: 'var(--slate-400)', textTransform: 'uppercase', marginBottom: 4 }}>Odometer</p>
                               <p style={{ fontSize: 14, fontWeight: 700 }}>{selectedReservation.dispatch_odometer_km.toLocaleString()} km</p>
                             </div>
                           )}
                           {selectedReservation.dispatch_fuel_level && (
                             <div>
                               <p style={{ fontSize: 10, color: 'var(--slate-400)', textTransform: 'uppercase', marginBottom: 4 }}>Fuel</p>
                               <p style={{ fontSize: 14, fontWeight: 700 }}>{selectedReservation.dispatch_fuel_level}</p>
                             </div>
                           )}
                           {selectedReservation.dispatch_condition_notes && (
                             <div style={{ gridColumn: '1 / -1' }}>
                               <p style={{ fontSize: 10, color: 'var(--slate-400)', textTransform: 'uppercase', marginBottom: 4 }}>Condition</p>
                               <p style={{ fontSize: 13, lineHeight: 1.5 }}>{selectedReservation.dispatch_condition_notes}</p>
                             </div>
                           )}
                           {selectedReservation.dispatch_recorded_at && (
                             <p style={{ fontSize: 11, color: 'var(--slate-400)', gridColumn: '1 / -1' }}>
                               Logged {formatDateTime(selectedReservation.dispatch_recorded_at)}
                             </p>
                           )}
                        </div>
                     </div>
                   )}

                   {(selectedReservation.return_odometer_km != null ||
                     selectedReservation.return_fuel_level ||
                     selectedReservation.return_condition_notes) && (
                     <div style={{ padding: 16, borderRadius: 12, border: '1px solid var(--slate-200)' }}>
                        <p style={{ fontSize: 12, fontWeight: 800, marginBottom: 12 }}>Return check-in</p>
                        <div className="customer-modal-grid-2" style={{ gap: 12 }}>
                           {selectedReservation.return_odometer_km != null && (
                             <div>
                               <p style={{ fontSize: 10, color: 'var(--slate-400)', textTransform: 'uppercase', marginBottom: 4 }}>Odometer</p>
                               <p style={{ fontSize: 14, fontWeight: 700 }}>{selectedReservation.return_odometer_km.toLocaleString()} km</p>
                             </div>
                           )}
                           {selectedReservation.return_fuel_level && (
                             <div>
                               <p style={{ fontSize: 10, color: 'var(--slate-400)', textTransform: 'uppercase', marginBottom: 4 }}>Fuel</p>
                               <p style={{ fontSize: 14, fontWeight: 700 }}>{selectedReservation.return_fuel_level}</p>
                             </div>
                           )}
                           {selectedReservation.km_driven != null && (
                             <div className="flex-start" style={{ gap: 8, gridColumn: '1 / -1', padding: 10, background: 'var(--brand-gold-light)', borderRadius: 8 }}>
                               <Gauge size={18} />
                               <span style={{ fontSize: 14, fontWeight: 800 }}>Trip distance (from odometer): {selectedReservation.km_driven.toLocaleString()} km</span>
                             </div>
                           )}
                           {selectedReservation.return_condition_notes && (
                             <div style={{ gridColumn: '1 / -1' }}>
                               <p style={{ fontSize: 10, color: 'var(--slate-400)', textTransform: 'uppercase', marginBottom: 4 }}>Notes</p>
                               <p style={{ fontSize: 13, lineHeight: 1.5 }}>{selectedReservation.return_condition_notes}</p>
                             </div>
                           )}
                           {selectedReservation.return_recorded_at && (
                             <p style={{ fontSize: 11, color: 'var(--slate-400)', gridColumn: '1 / -1' }}>
                               Logged {formatDateTime(selectedReservation.return_recorded_at)}
                             </p>
                           )}
                        </div>
                     </div>
                   )}

                   <div style={{ padding: 16, borderRadius: 12, border: '1px solid var(--slate-200)' }}>
                      <div className="flex-start" style={{ gap: 8, marginBottom: 12 }}>
                        <MessageSquare size={18} />
                        <span style={{ fontWeight: 800, fontSize: 14 }}>Messages on this booking</span>
                      </div>
                      <p style={{ fontSize: 12, color: 'var(--slate-500)', marginBottom: 12, lineHeight: 1.5 }}>
                        Chat with dispatch here—your booking reference stays tied to the conversation.
                      </p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 220, overflowY: 'auto', marginBottom: 12 }}>
                        {threadMessages.length === 0 ? (
                          <p style={{ fontSize: 13, color: 'var(--slate-400)' }}>No messages yet. Say hello and we’ll reply here.</p>
                        ) : (
                          threadMessages.map((m) => (
                            <div
                              key={m.id}
                              style={{
                                alignSelf: m.is_staff ? 'flex-start' : 'flex-end',
                                maxWidth: '92%',
                                padding: '10px 12px',
                                borderRadius: 10,
                                background: m.is_staff ? 'var(--slate-100)' : 'var(--slate-900)',
                                color: m.is_staff ? 'var(--slate-900)' : 'white',
                              }}
                            >
                              <div style={{ fontSize: 10, opacity: 0.85, marginBottom: 4 }}>
                                {m.is_staff ? 'Dispatch' : 'You'}
                                {m.profiles?.full_name && m.is_staff ? ` · ${m.profiles.full_name}` : ''} · {formatDateTime(m.created_at)}
                              </div>
                              <div style={{ fontSize: 13, lineHeight: 1.45, whiteSpace: 'pre-wrap' }}>{m.body}</div>
                            </div>
                          ))
                        )}
                      </div>
                      <div className="flex-start" style={{ gap: 8 }}>
                        <input
                          className="form-input"
                          style={{ flex: 1 }}
                          value={msgDraft}
                          onChange={(e) => setMsgDraft(e.target.value)}
                          placeholder="Write a message…"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              void handleSendThreadMessage();
                            }
                          }}
                        />
                        <button
                          type="button"
                          className="btn btn-brand btn-sm"
                          disabled={sendingMsg || !msgDraft.trim()}
                          onClick={() => void handleSendThreadMessage()}
                        >
                          {sendingMsg ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
                        </button>
                      </div>
                   </div>

                   <div className="reservation-modal-footer-btns" style={{ paddingTop: 24, borderTop: '1px solid var(--slate-100)' }}>
                      <button
                        onClick={() => {
                          const resId = selectedReservation.id;
                          const refStr = selectedReservation.reservation_id_str;
                          setSelectedReservation(null);
                          navigate('/customer/support', {
                            state: {
                              reservationId: resId,
                              subject: 'Booking Inquiry',
                              message: `Regarding booking ${refStr}: `,
                            },
                          });
                        }}
                        className="btn btn-outline"
                        style={{ height: 48, flex: 1 }}
                      >
                        Report a problem
                      </button>
                      <button onClick={() => setSelectedReservation(null)} className="btn btn-brand" style={{ height: 48, flex: 1 }}>Close</button>
                   </div>
                </div>
             </div>
          </div>
        </Portal>
      )}

      {/* Cancel Modal */}
      {reservationToCancel && (() => {
        const hrs = hoursUntil(reservationToCancel.start_date);
        const feeCents = computeCancellationFeeCents(reservationToCancel);
        const withinFeeWindow = feeCents > 0;
        const alreadyStarted = hrs < 0;
        return (
          <Portal>
            <div className="modal-backdrop">
               <div className="modal" style={{ textAlign: 'center', maxWidth: 440 }}>
                  <div style={{ width: 64, height: 64, background: 'var(--slate-50)', color: 'var(--slate-300)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                     <Trash2 size={32} />
                  </div>
                  <h2 style={{ marginBottom: 12 }}>Cancel this trip?</h2>
                  <p style={{ fontSize: 14, color: 'var(--slate-500)', lineHeight: '1.6', marginBottom: 16 }}>
                     This will cancel reservation <strong>{reservationToCancel.reservation_id_str}</strong> and release the assigned unit.
                  </p>

                  {withinFeeWindow && (
                    <div style={{ display: 'flex', gap: 12, padding: 14, background: 'rgba(239, 68, 68, 0.08)', color: '#b91c1c', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 12, marginBottom: 20, textAlign: 'left' }}>
                       <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: 2 }} />
                       <div style={{ fontSize: 12, lineHeight: 1.5 }}>
                          <strong>Cancellation fee applies.</strong> Pickup is in {Math.max(0, Math.round(hrs))}h — within the {cancelWindowHours}h policy window. A fee of <strong>{formatPHP(fromCents(feeCents))}</strong> ({cancelFeePct}% of the trip total) will remain due on your invoice after cancellation.
                       </div>
                    </div>
                  )}

                  {!withinFeeWindow && !alreadyStarted && (
                    <div style={{ fontSize: 12, color: 'var(--slate-500)', marginBottom: 20 }}>
                      You're outside the {cancelWindowHours}h cancellation window, so no fee applies and any outstanding invoice will be cancelled.
                    </div>
                  )}

                  <div className="customer-modal-footer-row">
                     <button onClick={() => setReservationToCancel(null)} className="btn btn-outline w-full">Keep Booking</button>
                     <button onClick={handleCancelReservation} disabled={isCancelling} className="btn btn-brand w-full" style={{ background: '#ef4444', color: 'white' }}>
                        {isCancelling ? <Loader2 className="animate-spin" /> : withinFeeWindow ? `Cancel & owe ${formatPHP(fromCents(feeCents))}` : 'Yes, Cancel'}
                     </button>
                  </div>
               </div>
            </div>
          </Portal>
        );
      })()}
    </div>
  );
}
