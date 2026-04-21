import { useEffect, useState } from 'react';
import { ClipboardList, Loader2, Send, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';
import { useRealtimeRefresh } from '../../lib/useRealtimeRefresh';
import { formatDateTime } from '../../lib/date';
import {
  INCIDENT_CATEGORY_GROUPS,
  labelForIncidentCategory,
  SEVERITY_OPTIONS,
  TRIP_PHASE_OPTIONS,
  type IncidentCategory,
} from '../../lib/incidentTaxonomy';

type Row = {
  id: string;
  report_number: string | null;
  occurred_at: string;
  category: string;
  subcategory_detail: string | null;
  severity: string;
  status: string;
  trip_phase: string | null;
  title: string;
  description: string;
  location_description: string | null;
  reservation_id: string | null;
  injuries_involved: boolean;
  police_notified: boolean;
  resolution_summary: string | null;
  created_at: string;
  reservations?: { reservation_id_str: string | null; destination: string | null } | null;
};

type MiniRes = { id: string; reservation_id_str: string; destination: string | null };

export default function IncidentReportsPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [reservations, setReservations] = useState<MiniRes[]>([]);

  const [form, setForm] = useState({
    category: 'other' as IncidentCategory,
    subcategory_detail: '',
    severity: 'Minor' as (typeof SEVERITY_OPTIONS)[number],
    trip_phase: 'Not Applicable' as (typeof TRIP_PHASE_OPTIONS)[number],
    title: '',
    description: '',
    occurred_at: '',
    location_description: '',
    reservation_id: '',
    injuries_involved: false,
    police_notified: false,
    witnesses_summary: '',
    property_damage_summary: '',
    immediate_actions: '',
  });

  const fetchList = async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('incident_reports')
      .select(
        'id, report_number, occurred_at, category, subcategory_detail, severity, status, trip_phase, title, description, location_description, reservation_id, injuries_involved, police_notified, resolution_summary, created_at, reservations(reservation_id_str, destination)',
      )
      .eq('reporter_id', auth.user.id)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) {
      console.warn('[incidents]', error.message);
      setRows([]);
    } else {
      setRows((data || []) as Row[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setUserId(data.user?.id ?? null);
    })();
    fetchList();
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) return;
      const { data } = await supabase
        .from('reservations')
        .select('id, reservation_id_str, destination')
        .eq('customer_id', auth.user.id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (data) setReservations(data as MiniRes[]);
    })();
  }, []);

  useEffect(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    setForm(f => ({ ...f, occurred_at: d.toISOString().slice(0, 16) }));
  }, []);

  useRealtimeRefresh(
    'incident_reports',
    () => fetchList(),
    { filter: userId ? `reporter_id=eq.${userId}` : undefined, enabled: !!userId },
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.description.trim()) {
      toast.error('Please add a title and description');
      return;
    }
    if (form.category === 'other' && !form.subcategory_detail.trim()) {
      toast.error('For “Other”, please describe what happened in the detail field');
      return;
    }
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user) {
      toast.error('You must be signed in');
      return;
    }
    const occurredAt = form.occurred_at
      ? new Date(form.occurred_at).toISOString()
      : new Date().toISOString();

    setSending(true);
    const { error } = await supabase.from('incident_reports').insert([
      {
        reporter_id: auth.user.id,
        occurred_at: occurredAt,
        category: form.category,
        subcategory_detail: form.subcategory_detail.trim() || null,
        severity: form.severity,
        status: 'Submitted',
        trip_phase: form.trip_phase,
        title: form.title.trim(),
        description: form.description.trim(),
        location_description: form.location_description.trim() || null,
        reservation_id: form.reservation_id || null,
        injuries_involved: form.injuries_involved,
        police_notified: form.police_notified,
        witnesses_summary: form.witnesses_summary.trim() || null,
        property_damage_summary: form.property_damage_summary.trim() || null,
        immediate_actions: form.immediate_actions.trim() || null,
      },
    ]);
    setSending(false);
    if (error) {
      toast.error(`Couldn't submit: ${error.message}`);
      return;
    }
    toast.success('Incident report filed. Our team will review it.');
    setForm(f => ({
      ...f,
      category: 'other',
      subcategory_detail: '',
      severity: 'Minor',
      trip_phase: 'Not Applicable',
      title: '',
      description: '',
      location_description: '',
      reservation_id: '',
      injuries_involved: false,
      police_notified: false,
      witnesses_summary: '',
      property_damage_summary: '',
      immediate_actions: '',
    }));
    fetchList();
  };

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="page-header" style={{ marginBottom: 0 }}>
        <div>
          <h1 style={{ fontSize: 32, display: 'flex', alignItems: 'center', gap: 12 }}>
            <ShieldAlert style={{ color: 'var(--brand-gold-dark)' }} size={32} />
            Incident reports
          </h1>
          <p style={{ maxWidth: 640 }}>
            File safety, service, or vehicle-related incidents using the full cooperative taxonomy—
            from collisions and medical events to scheduling, weather, billing, and governance. For
            general questions, use{' '}
            <a href="/customer/support" style={{ color: 'var(--indigo-600)', fontWeight: 700 }}>
              Support
            </a>
            .
          </p>
        </div>
      </div>

      <div className="support-two-col">
        <div className="card" style={{ padding: 32 }}>
          <div className="flex-start" style={{ gap: 12, marginBottom: 24 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: 'var(--rose-50)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ClipboardList style={{ color: 'var(--rose-500)' }} size={22} />
            </div>
            <div>
              <h3 style={{ fontSize: 20 }}>File a report</h3>
              <p style={{ fontSize: 13, color: 'var(--slate-500)', marginTop: 4 }}>
                Emergency? Call your driver or the cooperative helpline first if anyone is in danger.
              </p>
            </div>
          </div>

          <form onSubmit={submit} className="space-y-5">
            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ fontSize: 12, fontWeight: 800, color: 'var(--slate-500)', textTransform: 'uppercase' }}>
                When it occurred *
              </label>
              <input
                type="datetime-local"
                required
                value={form.occurred_at}
                onChange={e => setForm({ ...form, occurred_at: e.target.value })}
                style={{
                  background: 'var(--slate-50)',
                  border: '1px solid var(--slate-100)',
                  borderRadius: 12,
                  height: 52,
                  padding: '0 16px',
                }}
              />
            </div>

            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ fontSize: 12, fontWeight: 800, color: 'var(--slate-500)', textTransform: 'uppercase' }}>
                Category *
              </label>
              <select
                required
                value={form.category}
                onChange={e => setForm({ ...form, category: e.target.value as IncidentCategory })}
                style={{
                  background: 'var(--slate-50)',
                  border: '1px solid var(--slate-100)',
                  borderRadius: 12,
                  minHeight: 52,
                  padding: '12px 16px',
                }}
              >
                {INCIDENT_CATEGORY_GROUPS.map(g => (
                  <optgroup key={g.group} label={g.group}>
                    {g.items.map(i => (
                      <option key={i.value} value={i.value}>
                        {i.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ fontSize: 12, fontWeight: 800, color: 'var(--slate-500)', textTransform: 'uppercase' }}>
                Extra detail
              </label>
              <input
                value={form.subcategory_detail}
                onChange={e => setForm({ ...form, subcategory_detail: e.target.value })}
                placeholder='Required if you chose "Other"'
                style={{
                  background: 'var(--slate-50)',
                  border: '1px solid var(--slate-100)',
                  borderRadius: 12,
                  height: 52,
                  padding: '0 16px',
                }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label style={{ fontSize: 12, fontWeight: 800, color: 'var(--slate-500)', textTransform: 'uppercase' }}>
                  Severity *
                </label>
                <select
                  value={form.severity}
                  onChange={e => setForm({ ...form, severity: e.target.value as (typeof form)['severity'] })}
                  style={{
                    background: 'var(--slate-50)',
                    border: '1px solid var(--slate-100)',
                    borderRadius: 12,
                    height: 52,
                    padding: '0 16px',
                  }}
                >
                  {SEVERITY_OPTIONS.map(s => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label style={{ fontSize: 12, fontWeight: 800, color: 'var(--slate-500)', textTransform: 'uppercase' }}>
                  Trip phase
                </label>
                <select
                  value={form.trip_phase}
                  onChange={e => setForm({ ...form, trip_phase: e.target.value as (typeof form)['trip_phase'] })}
                  style={{
                    background: 'var(--slate-50)',
                    border: '1px solid var(--slate-100)',
                    borderRadius: 12,
                    height: 52,
                    padding: '0 16px',
                  }}
                >
                  {TRIP_PHASE_OPTIONS.map(s => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ fontSize: 12, fontWeight: 800, color: 'var(--slate-500)', textTransform: 'uppercase' }}>
                Related trip (optional)
              </label>
              <select
                value={form.reservation_id}
                onChange={e => setForm({ ...form, reservation_id: e.target.value })}
                style={{
                  background: 'var(--slate-50)',
                  border: '1px solid var(--slate-100)',
                  borderRadius: 12,
                  height: 52,
                  padding: '0 16px',
                }}
              >
                <option value="">Not specific to one booking</option>
                {reservations.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.reservation_id_str}
                    {r.destination ? ` — ${r.destination}` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ fontSize: 12, fontWeight: 800, color: 'var(--slate-500)', textTransform: 'uppercase' }}>
                Short title *
              </label>
              <input
                required
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
                placeholder="One-line summary"
                style={{
                  background: 'var(--slate-50)',
                  border: '1px solid var(--slate-100)',
                  borderRadius: 12,
                  height: 52,
                  padding: '0 16px',
                }}
              />
            </div>

            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ fontSize: 12, fontWeight: 800, color: 'var(--slate-500)', textTransform: 'uppercase' }}>
                What happened *
              </label>
              <textarea
                required
                rows={5}
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                placeholder="Who, what, where, sequence of events…"
                style={{
                  background: 'var(--slate-50)',
                  border: '1px solid var(--slate-100)',
                  borderRadius: 12,
                  padding: '16px',
                  resize: 'vertical',
                }}
              />
            </div>

            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ fontSize: 12, fontWeight: 800, color: 'var(--slate-500)', textTransform: 'uppercase' }}>
                Location (optional)
              </label>
              <input
                value={form.location_description}
                onChange={e => setForm({ ...form, location_description: e.target.value })}
                placeholder="Address, landmark, or route"
                style={{
                  background: 'var(--slate-50)',
                  border: '1px solid var(--slate-100)',
                  borderRadius: 12,
                  height: 52,
                  padding: '0 16px',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600 }}>
                <input
                  type="checkbox"
                  checked={form.injuries_involved}
                  onChange={e => setForm({ ...form, injuries_involved: e.target.checked })}
                />
                Injuries involved
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600 }}>
                <input
                  type="checkbox"
                  checked={form.police_notified}
                  onChange={e => setForm({ ...form, police_notified: e.target.checked })}
                />
                Police were notified
              </label>
            </div>

            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ fontSize: 12, fontWeight: 800, color: 'var(--slate-500)', textTransform: 'uppercase' }}>
                Witnesses (optional)
              </label>
              <textarea
                rows={2}
                value={form.witnesses_summary}
                onChange={e => setForm({ ...form, witnesses_summary: e.target.value })}
                style={{
                  background: 'var(--slate-50)',
                  border: '1px solid var(--slate-100)',
                  borderRadius: 12,
                  padding: '12px 16px',
                }}
              />
            </div>

            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ fontSize: 12, fontWeight: 800, color: 'var(--slate-500)', textTransform: 'uppercase' }}>
                Property / damage notes (optional)
              </label>
              <textarea
                rows={2}
                value={form.property_damage_summary}
                onChange={e => setForm({ ...form, property_damage_summary: e.target.value })}
                style={{
                  background: 'var(--slate-50)',
                  border: '1px solid var(--slate-100)',
                  borderRadius: 12,
                  padding: '12px 16px',
                }}
              />
            </div>

            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ fontSize: 12, fontWeight: 800, color: 'var(--slate-500)', textTransform: 'uppercase' }}>
                Immediate actions (optional)
              </label>
              <textarea
                rows={2}
                value={form.immediate_actions}
                onChange={e => setForm({ ...form, immediate_actions: e.target.value })}
                style={{
                  background: 'var(--slate-50)',
                  border: '1px solid var(--slate-100)',
                  borderRadius: 12,
                  padding: '12px 16px',
                }}
              />
            </div>

            <button
              type="submit"
              className="btn btn-brand"
              style={{ height: 52, width: '100%' }}
              disabled={sending}
            >
              {sending ? <Loader2 className="animate-spin" size={20} /> : <><Send size={18} /> Submit incident report</>}
            </button>
          </form>
        </div>

        <div className="card" style={{ padding: 32 }}>
          <h3 style={{ fontSize: 18, marginBottom: 8 }}>Your reports</h3>
          <p style={{ fontSize: 13, color: 'var(--slate-500)', marginBottom: 20 }}>
            Reference numbers and status updates appear here.
          </p>
          {loading ? (
            <p style={{ color: 'var(--slate-400)' }}>Loading…</p>
          ) : rows.length === 0 ? (
            <p style={{ color: 'var(--slate-400)', fontSize: 14 }}>You have not submitted any incident reports yet.</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
              {rows.map(r => (
                <li
                  key={r.id}
                  style={{
                    border: '1px solid var(--slate-100)',
                    borderRadius: 12,
                    padding: 16,
                    background: 'var(--slate-50)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 800, color: 'var(--indigo-600)' }}>{r.report_number}</span>
                    <span style={{ fontSize: 12, color: 'var(--slate-500)' }}>{formatDateTime(r.occurred_at)}</span>
                  </div>
                  <p style={{ fontWeight: 700, marginTop: 8 }}>{r.title}</p>
                  <p style={{ fontSize: 12, color: 'var(--slate-500)', marginTop: 4 }}>
                    {labelForIncidentCategory(r.category)} · {r.severity} · {r.status}
                  </p>
                  {r.reservations?.reservation_id_str && (
                    <p style={{ fontSize: 12, marginTop: 6, color: 'var(--indigo-600)', fontWeight: 600 }}>
                      Trip {r.reservations.reservation_id_str}
                    </p>
                  )}
                  {r.resolution_summary && (
                    <p style={{ fontSize: 13, marginTop: 10, color: 'var(--slate-700)' }}>
                      <strong>Update:</strong> {r.resolution_summary}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
