import { useEffect, useState } from 'react';
import { Plus, Wrench, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { formatPHP, fromCents, toCents } from '@/lib/formatters';
import { formatDate } from '@/lib/date';
import { useRealtimeRefresh } from '@/lib/useRealtimeRefresh';

type Record_ = {
  id: string;
  vehicle_id: string;
  service_type: string;
  scheduled_for: string | null;
  completed_on: string | null;
  odometer_km: number | null;
  cost_cents: number;
  status: 'Scheduled' | 'In Progress' | 'Completed' | 'Cancelled' | string;
  notes: string | null;
  issue_description?: string | null;
  cost_responsibility?: string | null;
  repaired_by?: string | null;
  work_completed_summary?: string | null;
  created_at: string;
};

const STATUS_OPTIONS = ['Scheduled', 'In Progress', 'Completed', 'Cancelled'] as const;
const STATUS_TONES: Record<string, string> = {
  Scheduled: 'badge-info',
  'In Progress': 'badge-warning',
  Completed: 'badge-success',
  Cancelled: 'badge-default',
};

const COST_RESP = ['TBD', 'Cooperative', 'Customer', 'Insurance', 'Warranty', 'Split'] as const;

const DEFAULT_FORM = {
  service_type: 'General Check-up',
  scheduled_for: '',
  completed_on: '',
  odometer_km: '',
  cost_php: '',
  notes: '',
  status: 'Scheduled' as typeof STATUS_OPTIONS[number],
  issue_description: '',
  cost_responsibility: 'TBD' as (typeof COST_RESP)[number],
  repaired_by: '',
  work_completed_summary: '',
};

const COMMON_SERVICES = [
  'General Check-up',
  'Oil Change',
  'Tire Rotation',
  'Brake Inspection',
  'Transmission Service',
  'Engine Tune-up',
  'Electrical',
  'Bodywork',
  'Other',
];

export function MaintenancePanel({ vehicleId, vehicleLabel }: { vehicleId: string; vehicleLabel?: string }) {
  const [records, setRecords] = useState<Record_[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editing, setEditing] = useState<Record_ | null>(null);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchRecords(); }, [vehicleId]);
  useRealtimeRefresh('maintenance_records', () => fetchRecords(), { filter: `vehicle_id=eq.${vehicleId}` });

  const fetchRecords = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('maintenance_records')
      .select('*')
      .eq('vehicle_id', vehicleId)
      .order('created_at', { ascending: false });
    if (error) toast.error(`Couldn't load maintenance: ${error.message}`);
    else setRecords((data || []) as Record_[]);
    setLoading(false);
  };

  const openAdd = () => { setEditing(null); setForm(DEFAULT_FORM); setIsAdding(true); };
  const openEdit = (r: Record_) => {
    setEditing(r);
    setForm({
      service_type: r.service_type,
      scheduled_for: r.scheduled_for || '',
      completed_on: r.completed_on || '',
      odometer_km: r.odometer_km?.toString() || '',
      cost_php: r.cost_cents ? String(fromCents(r.cost_cents)) : '',
      notes: r.notes || '',
      status: (STATUS_OPTIONS.includes(r.status as any) ? r.status : 'Scheduled') as any,
      issue_description: r.issue_description || '',
      cost_responsibility: (COST_RESP.includes(r.cost_responsibility as any) ? r.cost_responsibility : 'TBD') as (typeof COST_RESP)[number],
      repaired_by: r.repaired_by || '',
      work_completed_summary: r.work_completed_summary || '',
    });
    setIsAdding(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const { data: authData } = await supabase.auth.getUser();
    const payload = {
      vehicle_id: vehicleId,
      service_type: form.service_type,
      scheduled_for: form.scheduled_for || null,
      completed_on: form.completed_on || null,
      odometer_km: form.odometer_km ? Number(form.odometer_km) : null,
      cost_cents: form.cost_php ? toCents(Number(form.cost_php)) : 0,
      notes: form.notes || null,
      status: form.status,
      created_by: authData.user?.id || null,
      issue_description: form.issue_description.trim() || null,
      cost_responsibility: form.cost_responsibility,
      repaired_by: form.repaired_by.trim() || null,
      work_completed_summary: form.work_completed_summary.trim() || null,
    };
    const { error } = editing
      ? await supabase.from('maintenance_records').update(payload).eq('id', editing.id)
      : await supabase.from('maintenance_records').insert([payload]);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(editing ? 'Record updated' : 'Record added');
    setIsAdding(false);
    setEditing(null);
    fetchRecords();
  };

  const remove = async (r: Record_) => {
    if (!confirm('Delete this maintenance record?')) return;
    const { error } = await supabase.from('maintenance_records').delete().eq('id', r.id);
    if (error) { toast.error(error.message); return; }
    toast.success('Record deleted');
    fetchRecords();
  };

  const openCount = records.filter(r => r.status === 'Scheduled' || r.status === 'In Progress').length;
  const totalCost = records.reduce((s, r) => s + r.cost_cents, 0);

  return (
    <div style={{ padding: 12, background: 'var(--slate-50)', borderRadius: 'var(--radius-md)' }}>
      <div className="flex-between mb-3" style={{ gap: 8 }}>
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Wrench size={14} /> Maintenance Log {vehicleLabel ? `— ${vehicleLabel}` : ''}
          </h3>
          <p style={{ fontSize: 11, color: 'var(--slate-500)' }}>
            {openCount > 0 ? `${openCount} open record${openCount > 1 ? 's' : ''} — vehicle locked to Maintenance` : 'No open records'} · Lifetime cost {formatPHP(fromCents(totalCost))}
          </p>
        </div>
        <button className="btn btn-outline btn-xs" onClick={openAdd}><Plus size={12} /> Add</button>
      </div>

      <div className="table-wrapper" style={{ maxHeight: 280, overflowY: 'auto' }}>
        <table className="data-table">
          <thead><tr><th>Service / issue</th><th>Who pays</th><th>Scheduled</th><th>Done / who fixed</th><th>Cost</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 16, color: 'var(--slate-400)' }}>Loading…</td></tr>
            ) : records.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 16, color: 'var(--slate-400)' }}>No maintenance records yet.</td></tr>
            ) : records.map(r => (
              <tr key={r.id}>
                <td>
                  <div style={{ fontWeight: 600, fontSize: 12 }}>{r.service_type}</div>
                  {r.issue_description && (
                    <div style={{ fontSize: 11, color: 'var(--slate-600)', marginTop: 4 }}>Issue: {r.issue_description}</div>
                  )}
                  {r.work_completed_summary && (
                    <div style={{ fontSize: 11, color: 'var(--indigo-600)', marginTop: 2 }}>Done: {r.work_completed_summary}</div>
                  )}
                  {r.notes && <div style={{ fontSize: 11, color: 'var(--slate-500)' }}>{r.notes}</div>}
                </td>
                <td style={{ fontSize: 11 }}>{r.cost_responsibility || '—'}</td>
                <td style={{ fontSize: 12 }}>{r.scheduled_for ? formatDate(r.scheduled_for) : '—'}</td>
                <td style={{ fontSize: 11 }}>
                  {r.completed_on ? <div>{formatDate(r.completed_on)}</div> : <span style={{ color: 'var(--slate-400)' }}>—</span>}
                  {r.repaired_by && <div style={{ marginTop: 2 }}>by {r.repaired_by}</div>}
                </td>
                <td style={{ fontSize: 12, fontWeight: 600 }}>{r.cost_cents ? formatPHP(fromCents(r.cost_cents)) : '—'}</td>
                <td><span className={cn('badge', STATUS_TONES[r.status] || 'badge-outline')}>{r.status}</span></td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button className="btn btn-outline btn-xs" onClick={() => openEdit(r)}>Edit</button>
                  <button className="btn btn-outline btn-xs" style={{ marginLeft: 4, color: 'var(--rose-600)' }} onClick={() => remove(r)}>Del</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isAdding && (
        <div style={{ marginTop: 12, padding: 12, background: 'white', border: '1px solid var(--slate-200)', borderRadius: 'var(--radius-md)' }}>
          <div className="flex-between mb-2">
            <h4 style={{ fontSize: 13, fontWeight: 700 }}>{editing ? 'Edit Record' : 'New Maintenance Record'}</h4>
            <button className="btn-icon" onClick={() => { setIsAdding(false); setEditing(null); }}><X size={14} /></button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Service type</label>
                <select className="form-input" value={form.service_type} onChange={e => setForm({ ...form, service_type: e.target.value })}>
                  {COMMON_SERVICES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Status</label>
                <select className="form-input" value={form.status} onChange={e => setForm({ ...form, status: e.target.value as any })}>
                  {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div className="grid-2">
              <div className="form-group"><label className="form-label">Scheduled for</label><input className="form-input" type="date" value={form.scheduled_for} onChange={e => setForm({ ...form, scheduled_for: e.target.value })} /></div>
              <div className="form-group"><label className="form-label">Completed on</label><input className="form-input" type="date" value={form.completed_on} onChange={e => setForm({ ...form, completed_on: e.target.value })} /></div>
            </div>
            <div className="grid-2">
              <div className="form-group"><label className="form-label">Odometer (km)</label><input className="form-input" type="number" min="0" value={form.odometer_km} onChange={e => setForm({ ...form, odometer_km: e.target.value })} /></div>
              <div className="form-group"><label className="form-label">Cost (₱)</label><input className="form-input" type="number" min="0" step="0.01" value={form.cost_php} onChange={e => setForm({ ...form, cost_php: e.target.value })} /></div>
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Issue / damage</label>
                <input className="form-input" value={form.issue_description} onChange={e => setForm({ ...form, issue_description: e.target.value })} placeholder="What is wrong?" />
              </div>
              <div className="form-group">
                <label className="form-label">Who pays</label>
                <select className="form-input" value={form.cost_responsibility} onChange={e => setForm({ ...form, cost_responsibility: e.target.value as (typeof COST_RESP)[number] })}>
                  {COST_RESP.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Repaired by (when done)</label>
                <input className="form-input" value={form.repaired_by} onChange={e => setForm({ ...form, repaired_by: e.target.value })} placeholder="Shop or mechanic name" />
              </div>
              <div className="form-group">
                <label className="form-label">Work completed (summary)</label>
                <input className="form-input" value={form.work_completed_summary} onChange={e => setForm({ ...form, work_completed_summary: e.target.value })} placeholder="What was fixed" />
              </div>
            </div>
            <div className="form-group"><label className="form-label">Notes</label><input className="form-input" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Shop, parts replaced, follow-up…" /></div>
            <div className="flex-start gap-2">
              <button type="submit" className="btn btn-brand btn-sm" disabled={saving}>
                {saving ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : (editing ? 'Save Changes' : 'Add Record')}
              </button>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => { setIsAdding(false); setEditing(null); }}>Cancel</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
