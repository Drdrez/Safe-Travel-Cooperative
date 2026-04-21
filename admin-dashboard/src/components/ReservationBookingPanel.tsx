import { useEffect, useState } from 'react';
import { MessageSquare, Send, Save, Truck, RotateCcw, Gauge } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatDate, formatDateTime } from '@/lib/date';
import { toast } from 'sonner';

const FUEL_LEVELS = [
  'Full', '7/8', '3/4', '5/8', '1/2', '3/8', '1/4', '1/8', 'Empty',
] as const;

type MessageRow = {
  id: string;
  body: string;
  is_staff: boolean;
  created_at: string;
  author_id: string;
  profiles?: { full_name: string | null } | null;
};

interface ReservationBookingPanelProps {
  reservation: any;
  onReservationPatch: (row: any) => void;
}

export function ReservationBookingPanel({ reservation, onReservationPatch }: ReservationBookingPanelProps) {
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [loadingMsg, setLoadingMsg] = useState(true);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  const [dispatchOdo, setDispatchOdo] = useState('');
  const [dispatchFuel, setDispatchFuel] = useState<string>('');
  const [dispatchNotes, setDispatchNotes] = useState('');
  const [savingDispatch, setSavingDispatch] = useState(false);

  const [returnOdo, setReturnOdo] = useState('');
  const [returnFuel, setReturnFuel] = useState<string>('');
  const [returnNotes, setReturnNotes] = useState('');
  const [savingReturn, setSavingReturn] = useState(false);

  const loadMessages = async () => {
    const { data, error } = await supabase
      .from('reservation_messages')
      .select('id, body, is_staff, created_at, author_id, profiles!reservation_messages_author_id_fkey(full_name)')
      .eq('reservation_id', reservation.id)
      .order('created_at', { ascending: true });

    if (error) {
      toast.error(`Could not load messages: ${error.message}`);
      setMessages([]);
    } else {
      setMessages((data as unknown as MessageRow[]) ?? []);
    }
    setLoadingMsg(false);
  };

  useEffect(() => {
    setLoadingMsg(true);
    setDispatchOdo(reservation.dispatch_odometer_km != null ? String(reservation.dispatch_odometer_km) : '');
    setDispatchFuel(reservation.dispatch_fuel_level || '');
    setDispatchNotes(reservation.dispatch_condition_notes || '');
    setReturnOdo(reservation.return_odometer_km != null ? String(reservation.return_odometer_km) : '');
    setReturnFuel(reservation.return_fuel_level || '');
    setReturnNotes(reservation.return_condition_notes || '');
    setDraft('');
    void loadMessages();
    // Re-sync when the same booking is updated externally (realtime list refresh) — not only when id changes.
  }, [
    reservation.id,
    reservation.dispatch_odometer_km,
    reservation.dispatch_fuel_level,
    reservation.dispatch_condition_notes,
    reservation.return_odometer_km,
    reservation.return_fuel_level,
    reservation.return_condition_notes,
  ]);

  const sendStaffMessage = async () => {
    const body = draft.trim();
    if (!body) return;
    setSending(true);
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) {
      toast.error('Not signed in');
      setSending(false);
      return;
    }
    const { error } = await supabase.from('reservation_messages').insert({
      reservation_id: reservation.id,
      author_id: uid,
      body,
      is_staff: true,
    });
    setSending(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setDraft('');
    await loadMessages();
  };

  const parseOdo = (s: string): number | null => {
    const t = s.trim();
    if (!t) return null;
    const n = parseInt(t, 10);
    if (!Number.isFinite(n) || n < 0) return null;
    return n;
  };

  const saveDispatch = async () => {
    const odo = parseOdo(dispatchOdo);
    if (dispatchOdo.trim() && odo === null) {
      toast.error('Enter a valid odometer (whole kilometers).');
      return;
    }
    if (dispatchFuel && !FUEL_LEVELS.includes(dispatchFuel as (typeof FUEL_LEVELS)[number])) {
      toast.error('Select a fuel level or leave empty.');
      return;
    }
    setSavingDispatch(true);
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id ?? null;
    const nowIso = new Date().toISOString();
    const patch: Record<string, unknown> = {
      dispatch_odometer_km: odo,
      dispatch_fuel_level: dispatchFuel || null,
      dispatch_condition_notes: dispatchNotes.trim() || null,
      dispatch_recorded_at: odo != null || dispatchFuel || dispatchNotes.trim() ? nowIso : null,
      dispatch_recorded_by: odo != null || dispatchFuel || dispatchNotes.trim() ? uid : null,
    };

    const { data, error } = await supabase
      .from('reservations')
      .update(patch)
      .eq('id', reservation.id)
      .select('*, profiles!reservations_customer_id_fkey(full_name), vehicles(model, plate_number)')
      .single();

    setSavingDispatch(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (data) onReservationPatch(data);
    toast.success('Dispatch / handover saved');
  };

  const saveReturn = async () => {
    const odo = parseOdo(returnOdo);
    if (returnOdo.trim() && odo === null) {
      toast.error('Enter a valid odometer (whole kilometers).');
      return;
    }
    if (returnFuel && !FUEL_LEVELS.includes(returnFuel as (typeof FUEL_LEVELS)[number])) {
      toast.error('Select a fuel level or leave empty.');
      return;
    }
    setSavingReturn(true);
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id ?? null;
    const nowIso = new Date().toISOString();
    const patch: Record<string, unknown> = {
      return_odometer_km: odo,
      return_fuel_level: returnFuel || null,
      return_condition_notes: returnNotes.trim() || null,
      return_recorded_at: odo != null || returnFuel || returnNotes.trim() ? nowIso : null,
      return_recorded_by: odo != null || returnFuel || returnNotes.trim() ? uid : null,
    };

    const { data, error } = await supabase
      .from('reservations')
      .update(patch)
      .eq('id', reservation.id)
      .select('*, profiles!reservations_customer_id_fkey(full_name), vehicles(model, plate_number)')
      .single();

    setSavingReturn(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (data) onReservationPatch(data);
    toast.success('Return inspection saved');
  };

  const veh = reservation.vehicles as { model?: string; plate_number?: string } | undefined;
  const kmDriven = reservation.km_driven;

  return (
    <div className="space-y-6" style={{ maxHeight: 'min(70vh, 720px)', overflowY: 'auto', paddingRight: 4 }}>
      {reservation.customer_special_requests && (
        <div style={{ padding: 14, background: 'var(--slate-50)', borderRadius: 8, border: '1px solid var(--slate-100)' }}>
          <p className="form-label" style={{ marginBottom: 6 }}>Customer note (from booking)</p>
          <p style={{ fontSize: 13, lineHeight: 1.5, margin: 0 }}>{reservation.customer_special_requests}</p>
        </div>
      )}

      <div className="grid-2" style={{ gap: 16, alignItems: 'start' }}>
        <div style={{ padding: 16, border: '1px solid var(--slate-200)', borderRadius: 12 }}>
          <div className="flex-start" style={{ gap: 8, marginBottom: 12 }}>
            <Truck size={18} />
            <strong style={{ fontSize: 14 }}>Dispatch / handover</strong>
          </div>
          <p style={{ fontSize: 11, color: 'var(--slate-500)', marginBottom: 12 }}>
            Record when the customer receives the vehicle (odometer, fuel, condition).
          </p>
          {veh && (
            <p style={{ fontSize: 12, marginBottom: 12 }}>
              Unit: <strong>{veh.model}</strong>{veh.plate_number ? ` · ${veh.plate_number}` : ''}
            </p>
          )}
          <div className="form-group" style={{ marginBottom: 12 }}>
            <label className="form-label">Odometer (km)</label>
            <input
              className="form-input"
              inputMode="numeric"
              value={dispatchOdo}
              onChange={(e) => setDispatchOdo(e.target.value)}
              placeholder="e.g. 123324"
            />
          </div>
          <div className="form-group" style={{ marginBottom: 12 }}>
            <label className="form-label">Fuel gauge</label>
            <select className="form-select" value={dispatchFuel} onChange={(e) => setDispatchFuel(e.target.value)}>
              <option value="">Not recorded</option>
              {FUEL_LEVELS.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 12 }}>
            <label className="form-label">Condition / checklist</label>
            <textarea
              className="form-input"
              rows={3}
              value={dispatchNotes}
              onChange={(e) => setDispatchNotes(e.target.value)}
              placeholder="Body condition, tires, accessories, etc."
            />
          </div>
          <button type="button" className="btn btn-brand btn-sm" disabled={savingDispatch} onClick={() => void saveDispatch()}>
            <Save size={14} /> {savingDispatch ? 'Saving…' : 'Save dispatch'}
          </button>
          {reservation.dispatch_recorded_at && (
            <p style={{ fontSize: 11, color: 'var(--slate-400)', marginTop: 10 }}>
              Last recorded {formatDate(reservation.dispatch_recorded_at)}
            </p>
          )}
        </div>

        <div style={{ padding: 16, border: '1px solid var(--slate-200)', borderRadius: 12 }}>
          <div className="flex-start" style={{ gap: 8, marginBottom: 12 }}>
            <RotateCcw size={18} />
            <strong style={{ fontSize: 14 }}>Return</strong>
          </div>
          <p style={{ fontSize: 11, color: 'var(--slate-500)', marginBottom: 12 }}>
            Record when the vehicle comes back (km, fuel, any new damage).
          </p>
          {kmDriven != null && (
            <div
              className="flex-start"
              style={{
                gap: 8,
                marginBottom: 12,
                padding: 10,
                background: 'var(--brand-gold-light)',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              <Gauge size={18} />
              Trip distance (from odometer): {kmDriven.toLocaleString()} km
            </div>
          )}
          <div className="form-group" style={{ marginBottom: 12 }}>
            <label className="form-label">Odometer (km)</label>
            <input
              className="form-input"
              inputMode="numeric"
              value={returnOdo}
              onChange={(e) => setReturnOdo(e.target.value)}
              placeholder="e.g. 123900"
            />
          </div>
          <div className="form-group" style={{ marginBottom: 12 }}>
            <label className="form-label">Fuel gauge</label>
            <select className="form-select" value={returnFuel} onChange={(e) => setReturnFuel(e.target.value)}>
              <option value="">Not recorded</option>
              {FUEL_LEVELS.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 12 }}>
            <label className="form-label">Condition / notes</label>
            <textarea
              className="form-input"
              rows={3}
              value={returnNotes}
              onChange={(e) => setReturnNotes(e.target.value)}
              placeholder="Fuel, cleanliness, new scratches, etc."
            />
          </div>
          <button type="button" className="btn btn-brand btn-sm" disabled={savingReturn} onClick={() => void saveReturn()}>
            <Save size={14} /> {savingReturn ? 'Saving…' : 'Save return'}
          </button>
          {reservation.return_recorded_at && (
            <p style={{ fontSize: 11, color: 'var(--slate-400)', marginTop: 10 }}>
              Last recorded {formatDate(reservation.return_recorded_at)}
            </p>
          )}
        </div>
      </div>

      <div style={{ padding: 16, border: '1px solid var(--slate-200)', borderRadius: 12 }}>
        <div className="flex-start" style={{ gap: 8, marginBottom: 12 }}>
          <MessageSquare size={18} />
          <strong style={{ fontSize: 14 }}>Booking thread</strong>
        </div>
        <p style={{ fontSize: 11, color: 'var(--slate-500)', marginBottom: 12 }}>
          Messages stay on this booking so dispatch and the renter share one record—not scattered across Messenger.
        </p>
        <div
          style={{
            maxHeight: 220,
            overflowY: 'auto',
            marginBottom: 12,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          {loadingMsg ? (
            <p style={{ fontSize: 13, color: 'var(--slate-400)' }}>Loading…</p>
          ) : messages.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--slate-400)' }}>No messages yet. Send a note to the customer below.</p>
          ) : (
            messages.map((m) => (
              <div
                key={m.id}
                style={{
                  alignSelf: m.is_staff ? 'flex-end' : 'flex-start',
                  maxWidth: '92%',
                  padding: '10px 12px',
                  borderRadius: 10,
                  background: m.is_staff ? 'var(--slate-900)' : 'var(--slate-100)',
                  color: m.is_staff ? 'white' : 'var(--slate-800)',
                }}
              >
                <div style={{ fontSize: 10, opacity: 0.85, marginBottom: 4 }}>
                  {m.is_staff ? 'Dispatch' : 'Customer'}
                  {m.profiles?.full_name ? ` · ${m.profiles.full_name}` : ''} · {formatDateTime(m.created_at)}
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
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Reply to the customer…"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void sendStaffMessage();
              }
            }}
          />
          <button type="button" className="btn btn-brand btn-sm" disabled={sending || !draft.trim()} onClick={() => void sendStaffMessage()}>
            <Send size={14} /> Send
          </button>
        </div>
      </div>
    </div>
  );
}
