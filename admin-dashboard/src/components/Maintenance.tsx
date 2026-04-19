import { useEffect, useMemo, useState } from 'react';
import { Wrench, Search, Calendar, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { formatPHP, fromCents } from '@/lib/formatters';
import { formatDate } from '@/lib/date';
import { useRealtimeRefresh } from '@/lib/useRealtimeRefresh';
import { usePagination, TablePagination } from '@/lib/usePagination';
import { MaintenancePanel } from './MaintenancePanel';
import { Portal } from './ui/Portal';

type Record_ = {
  id: string;
  vehicle_id: string;
  service_type: string;
  scheduled_for: string | null;
  completed_on: string | null;
  cost_cents: number;
  status: string;
  notes: string | null;
  created_at: string;
  vehicles?: { model: string; plate_number: string; status: string } | null;
};

const STATUS_TONES: Record<string, string> = {
  Scheduled: 'badge-info',
  'In Progress': 'badge-warning',
  Completed: 'badge-success',
  Cancelled: 'badge-default',
};

const FILTERS = ['all', 'Scheduled', 'In Progress', 'Completed', 'Cancelled'] as const;

export function Maintenance() {
  const [records, setRecords] = useState<Record_[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<typeof FILTERS[number]>('all');
  const [detail, setDetail] = useState<Record_ | null>(null);

  useEffect(() => { fetchRecords(); }, []);
  useRealtimeRefresh('maintenance_records', () => fetchRecords());

  const fetchRecords = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('maintenance_records')
      .select('*, vehicles(model, plate_number, status)')
      .order('created_at', { ascending: false });
    if (error) toast.error(`Couldn't load maintenance: ${error.message}`);
    else setRecords((data || []) as any as Record_[]);
    setLoading(false);
  };

  const filtered = useMemo(() => {
    return records.filter(r => {
      if (filter !== 'all' && r.status !== filter) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        (r.service_type || '').toLowerCase().includes(q) ||
        (r.vehicles?.model || '').toLowerCase().includes(q) ||
        (r.vehicles?.plate_number || '').toLowerCase().includes(q)
      );
    });
  }, [records, filter, search]);
  const pagination = usePagination(filtered);

  const open = records.filter(r => r.status === 'Scheduled' || r.status === 'In Progress').length;
  const dueSoon = records.filter(r => {
    if (!r.scheduled_for || r.status === 'Completed' || r.status === 'Cancelled') return false;
    const ms = new Date(r.scheduled_for).getTime() - Date.now();
    return ms < 1000 * 60 * 60 * 24 * 7 && ms > 0;
  }).length;
  const totalCost = records.reduce((s, r) => s + r.cost_cents, 0);

  return (
    <div className="space-y-8">
      <div className="page-header">
        <div><h1>Vehicle Maintenance</h1><p>All maintenance activity across the fleet. Open records keep their vehicle locked to Maintenance.</p></div>
      </div>

      <div className="grid-3">
        <div className="card" style={{ borderTop: '4px solid var(--brand-gold)' }}>
          <div className="flex-between">
            <div><p style={{ fontSize: 13, color: 'var(--slate-500)' }}>Open Records</p><p style={{ fontSize: 24, fontWeight: 800 }}>{open}</p></div>
            <Wrench size={28} style={{ color: 'var(--brand-gold)' }} />
          </div>
        </div>
        <div className="card" style={{ borderTop: '4px solid var(--rose-500)' }}>
          <div className="flex-between">
            <div><p style={{ fontSize: 13, color: 'var(--slate-500)' }}>Due in 7 days</p><p style={{ fontSize: 24, fontWeight: 800, color: dueSoon ? 'var(--rose-600)' : 'var(--slate-700)' }}>{dueSoon}</p></div>
            <AlertTriangle size={28} style={{ color: dueSoon ? 'var(--rose-600)' : 'var(--slate-300)' }} />
          </div>
        </div>
        <div className="card" style={{ borderTop: '4px solid var(--slate-400)' }}>
          <div className="flex-between">
            <div><p style={{ fontSize: 13, color: 'var(--slate-500)' }}>Lifetime Spend</p><p style={{ fontSize: 24, fontWeight: 800 }}>{formatPHP(fromCents(totalCost))}</p></div>
            <Calendar size={28} style={{ color: 'var(--slate-500)' }} />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="flex-between mb-6" style={{ flexWrap: 'wrap', gap: 12 }}>
          <div className="search-bar"><Search className="search-icon" /><input placeholder="Search vehicle, service…" value={search} onChange={e => setSearch(e.target.value)} /></div>
          <div className="filter-tabs">
            {FILTERS.map(f => (
              <button key={f} className={cn('filter-tab', filter === f && 'active')} onClick={() => setFilter(f)}>{f}</button>
            ))}
          </div>
        </div>
        <div className="table-wrapper">
          <table className="data-table">
            <thead><tr><th>Vehicle</th><th>Service</th><th>Scheduled</th><th>Completed</th><th>Cost</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 48, color: 'var(--slate-400)' }}>Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 48, color: 'var(--slate-400)' }}>No maintenance records match.</td></tr>
              ) : pagination.items.map(r => (
                <tr key={r.id}>
                  <td>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{r.vehicles?.model || '—'}</div>
                    <div style={{ fontSize: 11, color: 'var(--slate-400)' }}>{r.vehicles?.plate_number || '—'}</div>
                  </td>
                  <td>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{r.service_type}</div>
                    {r.notes && <div style={{ fontSize: 11, color: 'var(--slate-500)' }}>{r.notes}</div>}
                  </td>
                  <td style={{ fontSize: 12 }}>{r.scheduled_for ? formatDate(r.scheduled_for) : '—'}</td>
                  <td style={{ fontSize: 12 }}>{r.completed_on ? formatDate(r.completed_on) : '—'}</td>
                  <td style={{ fontSize: 12, fontWeight: 600 }}>{r.cost_cents ? formatPHP(fromCents(r.cost_cents)) : '—'}</td>
                  <td><span className={cn('badge', STATUS_TONES[r.status] || 'badge-outline')}>{r.status}</span></td>
                  <td><button className="btn btn-outline btn-xs" onClick={() => setDetail(r)}>Open</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <TablePagination pagination={pagination} label="records" />
        </div>
      </div>

      {detail && (
        <Portal>
          <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setDetail(null); }}>
            <div className="modal modal-lg">
              <div className="modal-header">
                <h2>Maintenance — {detail.vehicles?.model} ({detail.vehicles?.plate_number})</h2>
                <button className="modal-close" onClick={() => setDetail(null)}>✕</button>
              </div>
              <MaintenancePanel vehicleId={detail.vehicle_id} vehicleLabel={`${detail.vehicles?.model} (${detail.vehicles?.plate_number})`} />
            </div>
          </div>
        </Portal>
      )}
    </div>
  );
}
