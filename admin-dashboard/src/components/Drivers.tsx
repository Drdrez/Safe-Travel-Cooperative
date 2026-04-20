import { useState, useEffect, useRef } from 'react';
import { Plus, Search, Phone, CreditCard, MoreVertical, X, Edit, Trash2, BarChart3 } from 'lucide-react';
import { supabase, invokeEdgeFunction } from '@/lib/supabase';
import { toast } from 'sonner';
import { Portal } from './ui/Portal';
import { useRealtimeRefresh } from '@/lib/useRealtimeRefresh';
import { usePagination, TablePagination } from '@/lib/usePagination';
import { formatPHP, fromCents } from '@/lib/formatters';
import { formatDate } from '@/lib/date';
import { cn } from '@/lib/utils';

type Driver = {
  id: string;
  full_name: string | null;
  email: string | null;
  contact_number: string | null;
  license_number: string | null;
  license_expiry: string | null;
  employment_status: string | null;
  role: string;
};

type Perf = {
  driver_id: string;
  full_name: string | null;
  total_trips: number;
  completed_trips: number;
  cancelled_trips: number;
  in_progress_trips: number;
  revenue_cents: number;
  last_trip_on: string | null;
};

type Trip = {
  id: string;
  reservation_id_str: string | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
  pickup_location: string | null;
  destination: string | null;
  estimated_cost_cents: number | null;
};

export function Drivers() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [performance, setPerformance] = useState<Perf[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', email: '', phone: '', license_number: '', license_expiry: '' });
  const [perfDriver, setPerfDriver] = useState<Driver | null>(null);
  const [perfTrips, setPerfTrips] = useState<Trip[]>([]);
  const [perfLoading, setPerfLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => { fetchDrivers(); }, []);
  useRealtimeRefresh(['profiles', 'reservations'], () => fetchDrivers());
  useEffect(() => {
    const h = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpenMenuId(null); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const fetchDrivers = async () => {
    setLoading(true);
    const [{ data: d, error: de }, { data: p, error: pe }] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, full_name, email, contact_number, license_number, license_expiry, employment_status, role')
        .eq('role', 'driver')
        .order('created_at', { ascending: false }),
      supabase.from('v_driver_performance').select('*'),
    ]);
    if (de) toast.error(`Couldn't load drivers: ${de.message}`);
    if (d) setDrivers(d as Driver[]);
    if (pe) toast.error(`Couldn't load performance: ${pe.message}`);
    if (p) setPerformance(p as Perf[]);
    setLoading(false);
  };

  const openAdd = () => { setEditingDriver(null); setForm({ name: '', email: '', phone: '', license_number: '', license_expiry: '' }); setIsFormOpen(true); };
  const openEdit = (d: Driver) => {
    setEditingDriver(d);
    setForm({
      name: d.full_name || '',
      email: d.email || '',
      phone: d.contact_number || '',
      license_number: d.license_number || '',
      license_expiry: d.license_expiry || '',
    });
    setIsFormOpen(true);
    setOpenMenuId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        full_name: form.name,
        email: form.email,
        contact_number: form.phone || null,
        license_number: form.license_number || null,
        license_expiry: form.license_expiry || null,
        role: 'driver',
      };
      if (editingDriver) {
        const { error } = await supabase.from('profiles').update(payload).eq('id', editingDriver.id);
        if (error) { toast.error(error.message); return; }
      } else {
        const { error: fnErr } = await invokeEdgeFunction('create-staff', {
          email: form.email.trim(),
          role: 'driver',
          full_name: form.name,
          contact_number: form.phone || null,
          license_number: form.license_number || null,
          license_expiry: form.license_expiry || null,
          employment_status: 'Active',
        });
        if (fnErr) { toast.error(fnErr); return; }
      }
      toast.success(editingDriver ? 'Driver updated' : 'Driver added');
      setIsFormOpen(false);
      fetchDrivers();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this driver?')) return;
    const { error } = await supabase.from('profiles').delete().eq('id', id);
    if (!error) { toast.success('Driver deleted'); fetchDrivers(); } else toast.error(error.message);
    setOpenMenuId(null);
  };

  const openPerformance = async (driver: Driver) => {
    setPerfDriver(driver);
    setOpenMenuId(null);
    setPerfLoading(true);
    const { data, error } = await supabase
      .from('reservations')
      .select('id, reservation_id_str, status, start_date, end_date, pickup_location, destination, estimated_cost_cents')
      .eq('driver_id', driver.id)
      .order('start_date', { ascending: false })
      .limit(25);
    if (error) toast.error(`Couldn't load trips: ${error.message}`);
    else setPerfTrips((data || []) as Trip[]);
    setPerfLoading(false);
  };

  const perfById = (id: string) => performance.find(p => p.driver_id === id);

  const filteredDrivers = drivers.filter(d => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (d.full_name || '').toLowerCase().includes(q) || (d.license_number || '').toLowerCase().includes(q);
  });
  const pagination = usePagination(filteredDrivers);

  const perf = perfDriver ? perfById(perfDriver.id) : undefined;
  const completionRate = perf && perf.total_trips > 0 ? Math.round((perf.completed_trips / perf.total_trips) * 100) : 0;

  return (
    <div className="space-y-8">
      <div className="page-header">
        <div><h1>Operators</h1><p>Manage drivers, licenses, and view trip performance.</p></div>
        <button className="btn btn-brand btn-sm" onClick={openAdd}><Plus size={16} /> Add Driver</button>
      </div>

      <div className="card">
        <div className="flex-between mb-6">
          <div className="search-bar"><Search className="search-icon" /><input placeholder="Search drivers..." value={search} onChange={e => setSearch(e.target.value)} /></div>
          <span className="badge badge-brand">DRIVER POOL</span>
        </div>

        <div className="table-wrapper">
          <table className="data-table">
            <thead><tr><th>Driver</th><th>License & Contact</th><th>Trips</th><th>Revenue</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 48, color: 'var(--slate-400)' }}>Loading operators…</td></tr>
              ) : filteredDrivers.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 48, color: 'var(--slate-400)' }}>No operators yet.</td></tr>
              ) : pagination.items.map((driver) => {
                const p = perfById(driver.id);
                return (
                  <tr key={driver.id}>
                    <td>
                      <div className="flex-start gap-3">
                        <div className="avatar">{driver.full_name?.[0] || 'D'}</div>
                        <div>
                          <p style={{ fontWeight: 600, fontSize: 13 }}>{driver.full_name || '—'}</p>
                          <p style={{ fontSize: 11, color: 'var(--slate-400)' }}>{driver.email || '—'}</p>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="space-y-2" style={{ fontSize: 11, color: 'var(--slate-500)' }}>
                        <p className="flex-start gap-2" style={{ fontWeight: 600, color: 'var(--slate-600)' }}>
                          <CreditCard size={14} style={{ color: 'var(--slate-300)' }} />
                          {driver.license_number || 'No license'}{driver.license_expiry ? ` · exp ${driver.license_expiry}` : ''}
                        </p>
                        <p className="flex-start gap-2"><Phone size={14} style={{ color: 'var(--slate-300)' }} /> {driver.contact_number || 'No contact'}</p>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: 12 }}>
                        <span style={{ fontWeight: 700 }}>{p?.completed_trips || 0}</span> completed
                        <span style={{ color: 'var(--slate-400)' }}> / {p?.total_trips || 0} total</span>
                      </div>
                      {p && p.cancelled_trips > 0 && (
                        <div style={{ fontSize: 11, color: 'var(--rose-600)' }}>{p.cancelled_trips} cancelled</div>
                      )}
                    </td>
                    <td style={{ fontSize: 12, fontWeight: 600 }}>{formatPHP(fromCents(p?.revenue_cents || 0))}</td>
                    <td>
                      <span className={cn('badge',
                        driver.employment_status === 'Active' ? 'badge-success' :
                        driver.employment_status === 'Suspended' ? 'badge-warning' :
                        driver.employment_status === 'Terminated' ? 'badge-error' : 'badge-outline')}>
                        {driver.employment_status || 'Active'}
                      </span>
                    </td>
                    <td style={{ position: 'relative' }}>
                      <button className="btn-icon" onClick={() => setOpenMenuId(openMenuId === driver.id ? null : driver.id)}><MoreVertical size={16} /></button>
                      {openMenuId === driver.id && (
                        <div className="dropdown-menu" ref={menuRef}>
                          <button className="dropdown-item" onClick={() => openPerformance(driver)}><BarChart3 size={14} /> View Performance</button>
                          <button className="dropdown-item" onClick={() => openEdit(driver)}><Edit size={14} /> Edit Driver</button>
                          <div className="dropdown-separator" />
                          <button className="dropdown-item danger" onClick={() => handleDelete(driver.id)}><Trash2 size={14} /> Delete Driver</button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <TablePagination pagination={pagination} label="drivers" />
        </div>
      </div>

      {isFormOpen && (
        <Portal>
          <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setIsFormOpen(false); }}>
            <div className="modal modal-md">
              <div className="modal-header">
                <h2>{editingDriver ? 'Edit Driver' : 'Add New Driver'}</h2>
                <button className="modal-close" onClick={() => setIsFormOpen(false)}><X size={20} /></button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="form-group"><label className="form-label">Full Name</label><input className="form-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Full name" required /></div>
                <div className="grid-2">
                  <div className="form-group"><label className="form-label">Email</label><input className="form-input" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required /></div>
                  <div className="form-group"><label className="form-label">Phone</label><input className="form-input" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="09## ### ####" /></div>
                </div>
                <div className="grid-2">
                  <div className="form-group"><label className="form-label">License Number</label><input className="form-input" value={form.license_number} onChange={e => setForm({ ...form, license_number: e.target.value })} placeholder="N01-12-345678" /></div>
                  <div className="form-group"><label className="form-label">License Expiry</label><input className="form-input" type="date" value={form.license_expiry} onChange={e => setForm({ ...form, license_expiry: e.target.value })} /></div>
                </div>
                <button type="submit" className="btn btn-brand btn-lg w-full" style={{ marginTop: 8 }} disabled={saving}>
                  {saving ? 'Saving…' : (editingDriver ? 'Save Changes' : 'Add Driver')}
                </button>
              </form>
            </div>
          </div>
        </Portal>
      )}

      {perfDriver && (
        <Portal>
          <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setPerfDriver(null); }}>
            <div className="modal modal-lg">
              <div className="modal-header">
                <h2>{perfDriver.full_name} — Driver Performance</h2>
                <button className="modal-close" onClick={() => setPerfDriver(null)}><X size={20} /></button>
              </div>

              <div className="grid-4" style={{ marginBottom: 16 }}>
                <div className="card"><p style={{ fontSize: 11, color: 'var(--slate-400)' }}>Total Trips</p><p style={{ fontSize: 22, fontWeight: 800 }}>{perf?.total_trips || 0}</p></div>
                <div className="card"><p style={{ fontSize: 11, color: 'var(--slate-400)' }}>Completed</p><p style={{ fontSize: 22, fontWeight: 800, color: 'var(--green-600)' }}>{perf?.completed_trips || 0}</p></div>
                <div className="card"><p style={{ fontSize: 11, color: 'var(--slate-400)' }}>Completion Rate</p><p style={{ fontSize: 22, fontWeight: 800 }}>{completionRate}%</p></div>
                <div className="card"><p style={{ fontSize: 11, color: 'var(--slate-400)' }}>Revenue Generated</p><p style={{ fontSize: 22, fontWeight: 800 }}>{formatPHP(fromCents(perf?.revenue_cents || 0))}</p></div>
              </div>

              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Recent trips</h3>
              <div className="table-wrapper" style={{ maxHeight: 380, overflowY: 'auto' }}>
                <table className="data-table">
                  <thead><tr><th>Ref</th><th>Date</th><th>Route</th><th>Amount</th><th>Status</th></tr></thead>
                  <tbody>
                    {perfLoading ? (
                      <tr><td colSpan={5} style={{ textAlign: 'center', padding: 24, color: 'var(--slate-400)' }}>Loading…</td></tr>
                    ) : perfTrips.length === 0 ? (
                      <tr><td colSpan={5} style={{ textAlign: 'center', padding: 24, color: 'var(--slate-400)' }}>No trips assigned.</td></tr>
                    ) : perfTrips.map(t => (
                      <tr key={t.id}>
                        <td style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11 }}>{t.reservation_id_str || t.id.slice(0, 8)}</td>
                        <td style={{ fontSize: 12 }}>{t.start_date ? formatDate(t.start_date) : '—'}</td>
                        <td style={{ fontSize: 12, color: 'var(--slate-600)' }}>{t.pickup_location || '?'} → {t.destination || '?'}</td>
                        <td style={{ fontSize: 12, fontWeight: 600 }}>{formatPHP(fromCents(t.estimated_cost_cents || 0))}</td>
                        <td>
                          <span className={cn('badge',
                            t.status === 'Completed' ? 'badge-success' :
                            t.status === 'Cancelled' ? 'badge-error' :
                            t.status === 'In Progress' ? 'badge-info' : 'badge-outline')}>{t.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </Portal>
      )}
    </div>
  );
}
