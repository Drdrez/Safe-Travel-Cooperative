import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, Loader2, Plus, RefreshCw, Send, X, ClipboardList,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { formatDateTime } from '@/lib/date';
import { useRealtimeRefresh } from '@/lib/useRealtimeRefresh';
import { usePagination, TablePagination } from '@/lib/usePagination';
import { Portal } from './ui/Portal';
import {
  INCIDENT_CATEGORY_GROUPS,
  labelForIncidentCategory,
  SEVERITY_OPTIONS,
  STATUS_OPTIONS,
  TRIP_PHASE_OPTIONS,
  type IncidentCategory,
} from '@/lib/incidentTaxonomy';

type ProfileMini = { full_name: string | null; email: string | null; role: string | null };
type StaffNote = {
  id: string;
  body: string;
  created_at: string;
  author_id: string | null;
  profiles?: { full_name: string | null } | null;
};

type IncidentRow = {
  id: string;
  report_number: string | null;
  reporter_id: string;
  occurred_at: string;
  category: string;
  subcategory_detail: string | null;
  severity: string;
  status: string;
  trip_phase: string | null;
  title: string;
  description: string;
  location_description: string | null;
  latitude: number | null;
  longitude: number | null;
  reservation_id: string | null;
  vehicle_id: string | null;
  driver_id: string | null;
  injuries_involved: boolean;
  police_notified: boolean;
  police_reference: string | null;
  insurance_reference: string | null;
  witnesses_summary: string | null;
  property_damage_summary: string | null;
  immediate_actions: string | null;
  resolution_summary: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  attachment_urls: unknown;
  created_at: string;
  updated_at: string;
  profiles?: ProfileMini | null;
  reservations?: {
    reservation_id_str: string | null;
    pickup_location: string | null;
    destination: string | null;
    status: string | null;
  } | null;
  vehicles?: { plate_number: string | null; model: string | null } | null;
  driver_profile?: ProfileMini | null;
};

const statusBadge = (s: string) => {
  switch (s) {
    case 'Draft': return 'badge-default';
    case 'Submitted': return 'badge-warning';
    case 'Under Review': return 'badge-info';
    case 'Resolved': return 'badge-success';
    case 'Closed': return 'badge-default';
    case 'Escalated': return 'badge-error';
    default: return 'badge-default';
  }
};

const severityBadge = (s: string) => {
  switch (s) {
    case 'Info': return 'badge-default';
    case 'Minor': return 'badge-success';
    case 'Moderate': return 'badge-warning';
    case 'Major': return 'badge-error';
    case 'Critical': return 'badge-error';
    default: return 'badge-default';
  }
};

export function IncidentReports() {
  const [rows, setRows] = useState<IncidentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [active, setActive] = useState<IncidentRow | null>(null);
  const [notes, setNotes] = useState<StaffNote[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [staffNote, setStaffNote] = useState('');
  const [saving, setSaving] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [reporterSearch, setReporterSearch] = useState('');
  const [reporterResults, setReporterResults] = useState<Array<{ id: string; full_name: string | null; email: string | null }>>([]);
  const [selectedReporter, setSelectedReporter] = useState<{ id: string; full_name: string | null; email: string | null } | null>(null);
  const [newForm, setNewForm] = useState({
    category: 'other' as IncidentCategory,
    subcategory_detail: '',
    severity: 'Minor' as typeof SEVERITY_OPTIONS[number],
    status: 'Submitted' as typeof STATUS_OPTIONS[number],
    trip_phase: 'Not Applicable' as typeof TRIP_PHASE_OPTIONS[number],
    title: '',
    description: '',
    occurred_at: '',
    location_description: '',
    reservation_id: '',
    vehicle_id: '',
    driver_id: '',
    injuries_involved: false,
    police_notified: false,
    police_reference: '',
    insurance_reference: '',
    witnesses_summary: '',
    property_damage_summary: '',
    immediate_actions: '',
  });
  const [reservationOpts, setReservationOpts] = useState<Array<{ id: string; reservation_id_str: string | null; destination: string | null }>>([]);
  const [vehicleOpts, setVehicleOpts] = useState<Array<{ id: string; plate_number: string | null; model: string | null }>>([]);
  const [driverOpts, setDriverOpts] = useState<Array<{ id: string; full_name: string | null }>>([]);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('incident_reports')
      .select(`
        id, report_number, reporter_id, occurred_at, category, subcategory_detail, severity, status, trip_phase,
        title, description, location_description, latitude, longitude,
        reservation_id, vehicle_id, driver_id,
        injuries_involved, police_notified, police_reference, insurance_reference,
        witnesses_summary, property_damage_summary, immediate_actions,
        resolution_summary, resolved_at, resolved_by, attachment_urls, created_at, updated_at,
        profiles!incident_reports_reporter_id_fkey(full_name, email, role),
        reservations(reservation_id_str, pickup_location, destination, status),
        vehicles(plate_number, model),
        driver_profile:profiles!incident_reports_driver_id_fkey(full_name, email, role)
      `)
      .order('occurred_at', { ascending: false });
    if (error) {
      toast.error(`Couldn't load incidents: ${error.message}`);
      setRows([]);
    } else {
      setRows((data || []) as unknown as IncidentRow[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchRows(); }, [fetchRows]);
  useRealtimeRefresh('incident_reports', () => fetchRows());

  const loadNotes = async (incidentId: string) => {
    setNotesLoading(true);
    const { data, error } = await supabase
      .from('incident_staff_notes')
      .select('id, body, created_at, author_id, profiles!incident_staff_notes_author_id_fkey(full_name)')
      .eq('incident_id', incidentId)
      .order('created_at', { ascending: true });
    if (error) toast.error(error.message);
    else setNotes((data || []) as unknown as StaffNote[]);
    setNotesLoading(false);
  };

  const openRow = (r: IncidentRow) => {
    setActive(r);
    setStaffNote('');
    loadNotes(r.id);
  };

  const saveStaffFields = async () => {
    if (!active) return;
    setSaving(true);
    const { data: auth } = await supabase.auth.getUser();
    const patch: Record<string, unknown> = {
      status: active.status,
      severity: active.severity,
      trip_phase: active.trip_phase,
      resolution_summary: active.resolution_summary,
      reservation_id: active.reservation_id || null,
      vehicle_id: active.vehicle_id || null,
      driver_id: active.driver_id || null,
      police_reference: active.police_reference,
      insurance_reference: active.insurance_reference,
      subcategory_detail: active.subcategory_detail,
    };
    if (active.status === 'Resolved' || active.status === 'Closed') {
      patch.resolved_at = active.resolved_at || new Date().toISOString();
      patch.resolved_by = auth?.user?.id ?? null;
    }
    const { error } = await supabase.from('incident_reports').update(patch).eq('id', active.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Incident updated');
    setActive(null);
    fetchRows();
  };

  const addStaffNote = async () => {
    if (!active || !staffNote.trim()) return;
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user?.id) return;
    const { error } = await supabase.from('incident_staff_notes').insert([{
      incident_id: active.id,
      author_id: auth.user.id,
      body: staffNote.trim(),
    }]);
    if (error) { toast.error(error.message); return; }
    setStaffNote('');
    loadNotes(active.id);
    toast.success('Note added');
  };

  useEffect(() => {
    if (!createOpen) return;
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    setNewForm(f => ({ ...f, occurred_at: d.toISOString().slice(0, 16) }));
  }, [createOpen]);

  const searchReporters = useCallback(async (q: string) => {
    const t = q.trim();
    if (t.length < 2) {
      setReporterResults([]);
      return;
    }
    const safe = t.replace(/[%]/g, '');
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .or(`email.ilike.%${safe}%,full_name.ilike.%${safe}%`)
      .limit(20);
    if (error) {
      toast.error(error.message);
      return;
    }
    setReporterResults(data || []);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => { searchReporters(reporterSearch); }, 300);
    return () => clearTimeout(t);
  }, [reporterSearch, searchReporters]);

  const loadDropdowns = () => {
    (async () => {
      const [r, v, d] = await Promise.all([
        supabase.from('reservations').select('id, reservation_id_str, destination').order('created_at', { ascending: false }).limit(120),
        supabase.from('vehicles').select('id, plate_number, model').order('plate_number', { ascending: true }).limit(200),
        supabase.from('profiles').select('id, full_name').eq('role', 'driver').order('full_name', { ascending: true }).limit(200),
      ]);
      if (r.data) setReservationOpts(r.data as any);
      if (v.data) setVehicleOpts(v.data as any);
      if (d.data) setDriverOpts(d.data as any);
    })();
  };

  const submitNew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReporter) {
      toast.error('Search and select who this report is for');
      return;
    }
    if (!newForm.title.trim() || !newForm.description.trim()) {
      toast.error('Title and description are required');
      return;
    }
    if (newForm.category === 'other' && !newForm.subcategory_detail?.trim()) {
      toast.error('For "Other", add detail in the subcategory field');
      return;
    }
    const occurredAt = newForm.occurred_at
      ? new Date(newForm.occurred_at).toISOString()
      : new Date().toISOString();

    setSaving(true);
    const { error } = await supabase.from('incident_reports').insert([{
      reporter_id: selectedReporter.id,
      occurred_at: occurredAt,
      category: newForm.category,
      subcategory_detail: newForm.subcategory_detail.trim() || null,
      severity: newForm.severity,
      status: newForm.status,
      trip_phase: newForm.trip_phase,
      title: newForm.title.trim(),
      description: newForm.description.trim(),
      location_description: newForm.location_description.trim() || null,
      reservation_id: newForm.reservation_id || null,
      vehicle_id: newForm.vehicle_id || null,
      driver_id: newForm.driver_id || null,
      injuries_involved: newForm.injuries_involved,
      police_notified: newForm.police_notified,
      police_reference: newForm.police_reference.trim() || null,
      insurance_reference: newForm.insurance_reference.trim() || null,
      witnesses_summary: newForm.witnesses_summary.trim() || null,
      property_damage_summary: newForm.property_damage_summary.trim() || null,
      immediate_actions: newForm.immediate_actions.trim() || null,
    }]);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Incident report created');
    setCreateOpen(false);
    setSelectedReporter(null);
    setReporterSearch('');
    setNewForm({
      category: 'other',
      subcategory_detail: '',
      severity: 'Minor',
      status: 'Submitted',
      trip_phase: 'Not Applicable',
      title: '',
      description: '',
      occurred_at: '',
      location_description: '',
      reservation_id: '',
      vehicle_id: '',
      driver_id: '',
      injuries_involved: false,
      police_notified: false,
      police_reference: '',
      insurance_reference: '',
      witnesses_summary: '',
      property_damage_summary: '',
      immediate_actions: '',
    });
    fetchRows();
  };

  const filtered = useMemo(() => rows.filter(r => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    if (severityFilter !== 'all' && r.severity !== severityFilter) return false;
    return true;
  }), [rows, statusFilter, severityFilter]);

  const pagination = usePagination(filtered);

  return (
    <div className="space-y-8">
      <div className="page-header">
        <div>
          <h1>Incident reports</h1>
          <p>
            Safety, service, vehicle, and operational incidents — standardized categories covering collisions,
            medical, security, scheduling, environment, compliance, and more.
          </p>
        </div>
        <div className="page-header-actions">
          <button type="button" className="btn btn-outline btn-sm" onClick={fetchRows} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : undefined} /> Refresh
          </button>
          <button
            type="button"
            className="btn btn-brand btn-sm"
            onClick={() => {
              loadDropdowns();
              setCreateOpen(true);
            }}
          >
            <Plus size={14} /> New report
          </button>
        </div>
      </div>

      <div className="card">
        <div className="flex-between mb-4" style={{ flexWrap: 'wrap', gap: 12 }}>
          <div className="filter-tabs" style={{ flexWrap: 'wrap' }}>
            {['all', ...STATUS_OPTIONS].map(s => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={cn('filter-tab', statusFilter === s && 'active')}
              >
                {s === 'all' ? 'All statuses' : s}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: 'var(--slate-400)' }}>Severity</span>
            <select
              className="form-select"
              style={{ width: 140 }}
              value={severityFilter}
              onChange={e => setSeverityFilter(e.target.value)}
            >
              <option value="all">All</option>
              {SEVERITY_OPTIONS.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <span style={{ fontSize: 12, color: 'var(--slate-400)' }}>{filtered.length} / {rows.length}</span>
          </div>
        </div>

        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Ref</th>
                <th>Title / category</th>
                <th>Severity</th>
                <th>When</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 48, color: 'var(--slate-400)' }}>Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 48, color: 'var(--slate-400)' }}>
                  <ClipboardList size={36} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                  <p style={{ fontWeight: 700 }}>No incident reports match</p>
                </td></tr>
              ) : pagination.items.map(r => (
                <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => openRow(r)}>
                  <td style={{ fontWeight: 800, fontSize: 12, color: 'var(--indigo-600)' }}>{r.report_number}</td>
                  <td>
                    <div>
                      <p style={{ fontWeight: 700, fontSize: 13 }}>{r.title}</p>
                      <p style={{ fontSize: 11, color: 'var(--slate-500)' }}>{labelForIncidentCategory(r.category)}</p>
                      <p style={{ fontSize: 11, color: 'var(--slate-400)' }}>
                        {r.profiles?.full_name || '—'}{r.profiles?.email ? ` · ${r.profiles.email}` : ''}
                      </p>
                    </div>
                  </td>
                  <td><span className={cn('badge', severityBadge(r.severity))}>{r.severity}</span></td>
                  <td style={{ fontSize: 12 }}>{formatDateTime(r.occurred_at)}</td>
                  <td><span className={cn('badge', statusBadge(r.status))}>{r.status}</span></td>
                  <td style={{ textAlign: 'right' }}>
                    <button type="button" className="btn btn-outline btn-sm" onClick={e => { e.stopPropagation(); openRow(r); }}>Open</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <TablePagination pagination={pagination} label="reports" />
        </div>
      </div>

      {createOpen && (
        <Portal>
          <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) setCreateOpen(false); }}>
            <div className="modal modal-lg" style={{ maxWidth: 720, maxHeight: '90vh', overflow: 'auto' }}>
              <div className="modal-header">
                <h2>New incident report</h2>
                <button type="button" className="modal-close" onClick={() => setCreateOpen(false)}><X size={20} /></button>
              </div>
              <form onSubmit={submitNew} className="space-y-3" style={{ padding: '0 4px 12px' }}>
                <div>
                  <label className="form-label">Reporter (search name or email) *</label>
                  <input
                    className="form-input"
                    value={reporterSearch}
                    onChange={e => { setReporterSearch(e.target.value); setSelectedReporter(null); }}
                    placeholder="Type at least 2 characters"
                  />
                  {reporterResults.length > 0 && (
                    <div style={{ border: '1px solid var(--slate-200)', borderRadius: 8, marginTop: 6, maxHeight: 180, overflow: 'auto' }}>
                      {reporterResults.map(p => (
                        <button
                          key={p.id}
                          type="button"
                          style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', border: 'none', background: selectedReporter?.id === p.id ? 'var(--indigo-50)' : 'white', cursor: 'pointer' }}
                          onClick={() => { setSelectedReporter(p); setReporterSearch(p.email || p.full_name || ''); setReporterResults([]); }}
                        >
                          <span style={{ fontWeight: 700 }}>{p.full_name || '—'}</span>
                          <span style={{ fontSize: 12, color: 'var(--slate-500)' }}> {p.email}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {selectedReporter && (
                    <p style={{ fontSize: 12, marginTop: 6, color: 'var(--emerald-600)', fontWeight: 700 }}>
                      Selected: {selectedReporter.full_name} ({selectedReporter.email})
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2" style={{ gap: 12 }}>
                  <div>
                    <label className="form-label">Occurred *</label>
                    <input
                      type="datetime-local"
                      className="form-input"
                      required
                      value={newForm.occurred_at}
                      onChange={e => setNewForm({ ...newForm, occurred_at: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="form-label">Trip phase</label>
                    <select
                      className="form-select"
                      value={newForm.trip_phase}
                      onChange={e => setNewForm({ ...newForm, trip_phase: e.target.value as typeof newForm.trip_phase })}
                    >
                      {TRIP_PHASE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="form-label">Category *</label>
                  <select
                    className="form-select"
                    required
                    value={newForm.category}
                    onChange={e => setNewForm({ ...newForm, category: e.target.value as IncidentCategory })}
                  >
                    {INCIDENT_CATEGORY_GROUPS.map(g => (
                      <optgroup key={g.group} label={g.group}>
                        {g.items.map(i => (
                          <option key={i.value} value={i.value}>{i.label}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="form-label">Subcategory / extra detail</label>
                  <input
                    className="form-input"
                    value={newForm.subcategory_detail}
                    onChange={e => setNewForm({ ...newForm, subcategory_detail: e.target.value })}
                    placeholder="Required if category is “Other”"
                  />
                </div>

                <div className="grid grid-cols-2" style={{ gap: 12 }}>
                  <div>
                    <label className="form-label">Severity *</label>
                    <select
                      className="form-select"
                      value={newForm.severity}
                      onChange={e => setNewForm({ ...newForm, severity: e.target.value as typeof newForm.severity })}
                    >
                      {SEVERITY_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Initial status</label>
                    <select
                      className="form-select"
                      value={newForm.status}
                      onChange={e => setNewForm({ ...newForm, status: e.target.value as typeof newForm.status })}
                    >
                      {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="form-label">Title *</label>
                  <input className="form-input" required value={newForm.title} onChange={e => setNewForm({ ...newForm, title: e.target.value })} />
                </div>
                <div>
                  <label className="form-label">Description *</label>
                  <textarea className="form-textarea" rows={4} required value={newForm.description} onChange={e => setNewForm({ ...newForm, description: e.target.value })} />
                </div>
                <div>
                  <label className="form-label">Location</label>
                  <input className="form-input" value={newForm.location_description} onChange={e => setNewForm({ ...newForm, location_description: e.target.value })} />
                </div>

                <div className="grid grid-cols-3" style={{ gap: 8 }}>
                  <div>
                    <label className="form-label">Booking</label>
                    <select
                      className="form-select"
                      value={newForm.reservation_id}
                      onChange={e => setNewForm({ ...newForm, reservation_id: e.target.value })}
                    >
                      <option value="">—</option>
                      {reservationOpts.map(o => (
                        <option key={o.id} value={o.id}>{o.reservation_id_str || o.id.slice(0, 8)} {o.destination ? `· ${o.destination}` : ''}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Vehicle</label>
                    <select
                      className="form-select"
                      value={newForm.vehicle_id}
                      onChange={e => setNewForm({ ...newForm, vehicle_id: e.target.value })}
                    >
                      <option value="">—</option>
                      {vehicleOpts.map(o => (
                        <option key={o.id} value={o.id}>{o.plate_number || o.id.slice(0, 8)} {o.model ? `· ${o.model}` : ''}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Driver</label>
                    <select
                      className="form-select"
                      value={newForm.driver_id}
                      onChange={e => setNewForm({ ...newForm, driver_id: e.target.value })}
                    >
                      <option value="">—</option>
                      {driverOpts.map(o => (
                        <option key={o.id} value={o.id}>{o.full_name || o.id.slice(0, 8)}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                    <input type="checkbox" checked={newForm.injuries_involved} onChange={e => setNewForm({ ...newForm, injuries_involved: e.target.checked })} />
                    Injuries involved
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                    <input type="checkbox" checked={newForm.police_notified} onChange={e => setNewForm({ ...newForm, police_notified: e.target.checked })} />
                    Police notified
                  </label>
                </div>
                <div className="grid grid-cols-2" style={{ gap: 12 }}>
                  <div>
                    <label className="form-label">Police ref.</label>
                    <input className="form-input" value={newForm.police_reference} onChange={e => setNewForm({ ...newForm, police_reference: e.target.value })} />
                  </div>
                  <div>
                    <label className="form-label">Insurance ref.</label>
                    <input className="form-input" value={newForm.insurance_reference} onChange={e => setNewForm({ ...newForm, insurance_reference: e.target.value })} />
                  </div>
                </div>
                <div>
                  <label className="form-label">Witnesses</label>
                  <textarea className="form-textarea" rows={2} value={newForm.witnesses_summary} onChange={e => setNewForm({ ...newForm, witnesses_summary: e.target.value })} />
                </div>
                <div>
                  <label className="form-label">Property damage</label>
                  <textarea className="form-textarea" rows={2} value={newForm.property_damage_summary} onChange={e => setNewForm({ ...newForm, property_damage_summary: e.target.value })} />
                </div>
                <div>
                  <label className="form-label">Immediate actions taken</label>
                  <textarea className="form-textarea" rows={2} value={newForm.immediate_actions} onChange={e => setNewForm({ ...newForm, immediate_actions: e.target.value })} />
                </div>

                <div className="modal-footer" style={{ gap: 8 }}>
                  <button type="button" className="btn btn-outline btn-md" onClick={() => setCreateOpen(false)}>Cancel</button>
                  <button type="submit" className="btn btn-brand btn-md" disabled={saving}>
                    {saving ? <Loader2 size={16} className="animate-spin" /> : 'Create report'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </Portal>
      )}

      {active && (
        <Portal>
          <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) setActive(null); }}>
            <div className="modal modal-lg" style={{ maxWidth: 720, maxHeight: '92vh', overflow: 'auto' }}>
              <div className="modal-header">
                <div>
                  <h2 style={{ marginBottom: 4 }}>{active.report_number}</h2>
                  <p style={{ fontSize: 13, color: 'var(--slate-500)', fontWeight: 600 }}>{active.title}</p>
                </div>
                <button type="button" className="modal-close" onClick={() => setActive(null)}><X size={20} /></button>
              </div>

              <div className="space-y-4" style={{ paddingBottom: 12 }}>
                <div className="grid grid-cols-2" style={{ gap: 12 }}>
                  <div>
                    <p className="form-label">Status</p>
                    <select
                      className="form-select"
                      value={active.status}
                      onChange={e => setActive({ ...active, status: e.target.value })}
                    >
                      {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <p className="form-label">Severity</p>
                    <select
                      className="form-select"
                      value={active.severity}
                      onChange={e => setActive({ ...active, severity: e.target.value })}
                    >
                      {SEVERITY_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>

                <div style={{ padding: 12, background: 'var(--slate-50)', borderRadius: 8 }}>
                  <p style={{ fontSize: 11, fontWeight: 800, color: 'var(--slate-400)', textTransform: 'uppercase' }}>Reporter</p>
                  <p style={{ fontWeight: 700 }}>{active.profiles?.full_name} — {active.profiles?.email}</p>
                  <p style={{ fontSize: 12, color: 'var(--slate-500)' }}>{labelForIncidentCategory(active.category)}</p>
                  {active.subcategory_detail && (
                    <p style={{ fontSize: 12 }}>Detail: {active.subcategory_detail}</p>
                  )}
                </div>

                <div>
                  <p className="form-label">Description</p>
                  <p style={{ padding: 12, background: 'var(--slate-50)', borderRadius: 8, fontSize: 13, whiteSpace: 'pre-wrap' }}>{active.description}</p>
                </div>

                <div>
                  <p className="form-label">Trip phase</p>
                  <select
                    className="form-select"
                    value={active.trip_phase || 'Not Applicable'}
                    onChange={e => setActive({ ...active, trip_phase: e.target.value })}
                  >
                    {TRIP_PHASE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>

                <div>
                  <p className="form-label">Resolution summary (visible to reporter)</p>
                  <textarea
                    className="form-textarea"
                    rows={3}
                    value={active.resolution_summary || ''}
                    onChange={e => setActive({ ...active, resolution_summary: e.target.value })}
                  />
                </div>

                <div style={{ borderTop: '1px solid var(--slate-100)', paddingTop: 12 }}>
                  <p style={{ fontWeight: 800, fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <AlertTriangle size={14} /> Staff notes (internal)
                  </p>
                  {notesLoading ? (
                    <p style={{ fontSize: 12, color: 'var(--slate-400)' }}>Loading notes…</p>
                  ) : (
                    <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {notes.map(n => (
                        <div key={n.id} style={{ padding: 10, background: 'var(--amber-50)', borderRadius: 8, fontSize: 12 }}>
                          <span style={{ color: 'var(--slate-500)' }}>{formatDateTime(n.created_at)} · {n.profiles?.full_name || 'Staff'}</span>
                          <p style={{ marginTop: 4, whiteSpace: 'pre-wrap' }}>{n.body}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  <textarea
                    className="form-textarea"
                    style={{ marginTop: 8 }}
                    rows={2}
                    placeholder="Add internal note…"
                    value={staffNote}
                    onChange={e => setStaffNote(e.target.value)}
                  />
                  <button type="button" className="btn btn-outline btn-sm" style={{ marginTop: 6 }} onClick={addStaffNote}>
                    Add note
                  </button>
                </div>

                <div className="modal-footer" style={{ gap: 8 }}>
                  <button type="button" className="btn btn-outline btn-md" onClick={() => setActive(null)}>Close</button>
                  <button type="button" className="btn btn-brand btn-md" onClick={saveStaffFields} disabled={saving}>
                    {saving ? <Loader2 size={16} className="animate-spin" /> : <><Send size={14} /> Save changes</>}
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
