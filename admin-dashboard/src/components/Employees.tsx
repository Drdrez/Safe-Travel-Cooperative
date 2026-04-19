import { useState, useEffect, useRef } from 'react';
import { UserPlus, Mail, Phone, MoreVertical, Search, X, Edit, Trash2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Portal } from './ui/Portal';
import { useRealtimeRefresh } from '@/lib/useRealtimeRefresh';
import { usePagination, TablePagination } from '@/lib/usePagination';
import { formatPHP, fromCents, toCents } from '@/lib/formatters';

type HREmployee = {
  id: string;
  full_name: string | null;
  email: string | null;
  contact_number: string | null;
  role: string;
  created_at: string;
  hire_date: string | null;
  job_title: string | null;
  employment_status: string | null;
  license_number: string | null;
  license_expiry: string | null;
  emergency_contact: string | null;
  base_rate_cents: number | null;
  rate_period: string | null;
};

const ROLE_OPTIONS = ['admin', 'dispatcher', 'driver'] as const;
const EMPLOYMENT_STATUS = ['Active', 'Probationary', 'Suspended', 'Terminated', 'Resigned'] as const;
const RATE_PERIODS = ['monthly', 'daily', 'hourly'] as const;

const EMPTY_FORM = {
  name: '',
  email: '',
  role: 'dispatcher' as (typeof ROLE_OPTIONS)[number],
  phone: '',
  hire_date: '',
  job_title: '',
  employment_status: 'Active' as (typeof EMPLOYMENT_STATUS)[number],
  license_number: '',
  license_expiry: '',
  emergency_contact: '',
  base_rate_php: '',
  rate_period: 'monthly' as (typeof RATE_PERIODS)[number],
};

const isLicenseExpiringSoon = (iso: string | null) => {
  if (!iso) return false;
  const ms = new Date(iso).getTime() - Date.now();
  return ms < 1000 * 60 * 60 * 24 * 60; // 60 days
};

export function Employees() {
  const [employees, setEmployees] = useState<HREmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | (typeof ROLE_OPTIONS)[number]>('all');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingEmp, setEditingEmp] = useState<HREmployee | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => { fetchEmployees(); }, []);
  useRealtimeRefresh('profiles', () => fetchEmployees());
  useEffect(() => {
    const h = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpenMenuId(null); };
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h);
  }, []);

  const fetchEmployees = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, contact_number, role, created_at, hire_date, job_title, employment_status, license_number, license_expiry, emergency_contact, base_rate_cents, rate_period')
      .in('role', ['admin', 'dispatcher', 'driver'])
      .order('created_at', { ascending: false });
    if (error) toast.error(`Couldn't load personnel: ${error.message}`);
    if (data) setEmployees(data as HREmployee[]);
    setLoading(false);
  };

  const openAdd = () => { setEditingEmp(null); setForm(EMPTY_FORM); setIsFormOpen(true); };
  const openEdit = (e: HREmployee) => {
    setEditingEmp(e);
    setForm({
      name: e.full_name || '',
      email: e.email || '',
      role: (ROLE_OPTIONS.includes(e.role as any) ? e.role : 'dispatcher') as any,
      phone: e.contact_number || '',
      hire_date: e.hire_date || '',
      job_title: e.job_title || '',
      employment_status: (EMPLOYMENT_STATUS.includes(e.employment_status as any) ? e.employment_status : 'Active') as any,
      license_number: e.license_number || '',
      license_expiry: e.license_expiry || '',
      emergency_contact: e.emergency_contact || '',
      base_rate_php: e.base_rate_cents ? String(fromCents(e.base_rate_cents)) : '',
      rate_period: (RATE_PERIODS.includes(e.rate_period as any) ? e.rate_period : 'monthly') as any,
    });
    setIsFormOpen(true);
    setOpenMenuId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      full_name: form.name,
      email: form.email,
      role: form.role,
      contact_number: form.phone || null,
      hire_date: form.hire_date || null,
      job_title: form.job_title || null,
      employment_status: form.employment_status,
      license_number: form.license_number || null,
      license_expiry: form.license_expiry || null,
      emergency_contact: form.emergency_contact || null,
      base_rate_cents: form.base_rate_php ? toCents(Number(form.base_rate_php)) : 0,
      rate_period: form.rate_period,
    };
    const { error } = editingEmp
      ? await supabase.from('profiles').update(payload).eq('id', editingEmp.id)
      : await supabase.from('profiles').insert([payload]);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(editingEmp ? 'Personnel updated' : 'Personnel added');
    setIsFormOpen(false);
    fetchEmployees();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this staff member? This cannot be undone.')) return;
    const { error } = await supabase.from('profiles').delete().eq('id', id);
    if (!error) { toast.success('Personnel removed'); fetchEmployees(); } else toast.error(error.message);
    setOpenMenuId(null);
  };

  const filtered = employees.filter(e => {
    if (roleFilter !== 'all' && e.role !== roleFilter) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (e.full_name || '').toLowerCase().includes(q) ||
      (e.email || '').toLowerCase().includes(q) ||
      (e.job_title || '').toLowerCase().includes(q) ||
      (e.license_number || '').toLowerCase().includes(q)
    );
  });
  const pagination = usePagination(filtered);

  const countActive = employees.filter(e => e.employment_status === 'Active').length;
  const countExpiring = employees.filter(e => isLicenseExpiringSoon(e.license_expiry)).length;

  return (
    <div className="space-y-8">
      <div className="page-header">
        <div>
          <h1>Personnel Management</h1>
          <p>HR records for admins, dispatchers, and drivers — contracts, licenses, and rates.</p>
        </div>
        <button className="btn btn-brand btn-sm" onClick={openAdd}><UserPlus size={16} /> Add Personnel</button>
      </div>

      <div className="grid-3">
        <div className="card"><p style={{ fontSize: 13, color: 'var(--slate-500)' }}>Total Personnel</p><p style={{ fontSize: 24, fontWeight: 800 }}>{employees.length}</p></div>
        <div className="card"><p style={{ fontSize: 13, color: 'var(--slate-500)' }}>Active</p><p style={{ fontSize: 24, fontWeight: 800, color: 'var(--green-600)' }}>{countActive}</p></div>
        <div className="card"><p style={{ fontSize: 13, color: 'var(--slate-500)' }}>Licenses Expiring (&lt;60d)</p><p style={{ fontSize: 24, fontWeight: 800, color: countExpiring ? 'var(--rose-600)' : 'var(--slate-700)' }}>{countExpiring}</p></div>
      </div>

      <div className="card">
        <div className="flex-between mb-6" style={{ flexWrap: 'wrap', gap: 12 }}>
          <div className="search-bar"><Search className="search-icon" /><input placeholder="Search by name, email, license…" value={search} onChange={e => setSearch(e.target.value)} /></div>
          <div className="filter-tabs">
            {(['all', ...ROLE_OPTIONS] as const).map(r => (
              <button key={r} className={cn('filter-tab', roleFilter === r && 'active')} onClick={() => setRoleFilter(r)} style={{ textTransform: 'capitalize' }}>{r}</button>
            ))}
          </div>
        </div>

        <div className="table-wrapper">
          <table className="data-table">
            <thead><tr><th>Name</th><th>Role / Title</th><th>Contact</th><th>License</th><th>Rate</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 48, color: 'var(--slate-400)' }}>Loading personnel…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 48, color: 'var(--slate-400)' }}>No personnel match.</td></tr>
              ) : pagination.items.map((emp) => {
                const licExpiring = isLicenseExpiringSoon(emp.license_expiry);
                return (
                  <tr key={emp.id}>
                    <td>
                      <div className="flex-start gap-3">
                        <div className="avatar">{emp.full_name?.[0] || 'S'}</div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{emp.full_name || '—'}</div>
                          <div style={{ fontSize: 11, color: 'var(--slate-400)' }}>Hired {emp.hire_date || 'n/a'}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div><span className={cn('badge', emp.role === 'admin' ? 'badge-success' : emp.role === 'driver' ? 'badge-info' : 'badge-outline')}>{emp.role}</span></div>
                      <div style={{ fontSize: 12, color: 'var(--slate-500)', marginTop: 4 }}>{emp.job_title || '—'}</div>
                    </td>
                    <td>
                      <div className="space-y-2" style={{ fontSize: 11, color: 'var(--slate-500)' }}>
                        <p className="flex-start gap-2"><Mail size={14} style={{ color: 'var(--slate-300)' }} /> {emp.email || '—'}</p>
                        <p className="flex-start gap-2"><Phone size={14} style={{ color: 'var(--slate-300)' }} /> {emp.contact_number || '—'}</p>
                      </div>
                    </td>
                    <td>
                      {emp.license_number ? (
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 12 }}>{emp.license_number}</div>
                          <div style={{ fontSize: 11, color: licExpiring ? 'var(--rose-600)' : 'var(--slate-400)' }}>
                            {licExpiring && <AlertTriangle size={11} style={{ marginRight: 4, verticalAlign: -1 }} />}
                            Exp {emp.license_expiry || '—'}
                          </div>
                        </div>
                      ) : <span style={{ color: 'var(--slate-400)', fontSize: 12 }}>—</span>}
                    </td>
                    <td>
                      {emp.base_rate_cents ? (
                        <div style={{ fontSize: 12 }}>
                          <div style={{ fontWeight: 600 }}>{formatPHP(fromCents(emp.base_rate_cents))}</div>
                          <div style={{ fontSize: 11, color: 'var(--slate-400)' }}>per {emp.rate_period}</div>
                        </div>
                      ) : <span style={{ color: 'var(--slate-400)', fontSize: 12 }}>—</span>}
                    </td>
                    <td>
                      <span className={cn('badge',
                        emp.employment_status === 'Active' ? 'badge-success' :
                        emp.employment_status === 'Probationary' ? 'badge-warning' :
                        emp.employment_status === 'Suspended' ? 'badge-warning' :
                        emp.employment_status === 'Terminated' ? 'badge-error' :
                        emp.employment_status === 'Resigned' ? 'badge-default' : 'badge-outline'
                      )}>{emp.employment_status || 'Active'}</span>
                    </td>
                    <td style={{ position: 'relative' }}>
                      <button className="btn-icon" onClick={() => setOpenMenuId(openMenuId === emp.id ? null : emp.id)}><MoreVertical size={16} /></button>
                      {openMenuId === emp.id && (
                        <div className="dropdown-menu" ref={menuRef}>
                          <button className="dropdown-item" onClick={() => openEdit(emp)}><Edit size={14} /> Edit</button>
                          <div className="dropdown-separator" />
                          <button className="dropdown-item danger" onClick={() => handleDelete(emp.id)}><Trash2 size={14} /> Delete</button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <TablePagination pagination={pagination} label="employees" />
        </div>
      </div>

      {isFormOpen && (
        <Portal>
          <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setIsFormOpen(false); }}>
            <div className="modal modal-lg">
              <div className="modal-header">
                <h2>{editingEmp ? 'Edit Personnel' : 'Add New Personnel'}</h2>
                <button className="modal-close" onClick={() => setIsFormOpen(false)}><X size={20} /></button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid-2">
                  <div className="form-group"><label className="form-label">Full Name</label><input className="form-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Enter name" required /></div>
                  <div className="form-group"><label className="form-label">Job Title</label><input className="form-input" value={form.job_title} onChange={e => setForm({ ...form, job_title: e.target.value })} placeholder="e.g. Senior Dispatcher" /></div>
                </div>
                <div className="grid-2">
                  <div className="form-group"><label className="form-label">Email</label><input className="form-input" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="email@example.com" required /></div>
                  <div className="form-group"><label className="form-label">Phone</label><input className="form-input" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="09## ### ####" /></div>
                </div>
                <div className="form-group">
                  <label className="form-label">Assign Role</label>
                  <div className="toggle-group">
                    {ROLE_OPTIONS.map(r => (
                      <button key={r} type="button" onClick={() => setForm({ ...form, role: r })}
                        className={cn('toggle-btn', form.role === r && 'active')} style={{ textTransform: 'capitalize' }}>{r}</button>
                    ))}
                  </div>
                </div>
                <div className="grid-2">
                  <div className="form-group"><label className="form-label">Hire Date</label><input className="form-input" type="date" value={form.hire_date} onChange={e => setForm({ ...form, hire_date: e.target.value })} /></div>
                  <div className="form-group">
                    <label className="form-label">Employment Status</label>
                    <select className="form-input" value={form.employment_status} onChange={e => setForm({ ...form, employment_status: e.target.value as any })}>
                      {EMPLOYMENT_STATUS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid-2">
                  <div className="form-group"><label className="form-label">License No. {form.role === 'driver' && <span style={{ color: 'var(--rose-500)' }}>*</span>}</label><input className="form-input" value={form.license_number} onChange={e => setForm({ ...form, license_number: e.target.value })} placeholder="N01-12-345678" required={form.role === 'driver'} /></div>
                  <div className="form-group"><label className="form-label">License Expiry</label><input className="form-input" type="date" value={form.license_expiry} onChange={e => setForm({ ...form, license_expiry: e.target.value })} /></div>
                </div>
                <div className="form-group"><label className="form-label">Emergency Contact</label><input className="form-input" value={form.emergency_contact} onChange={e => setForm({ ...form, emergency_contact: e.target.value })} placeholder="Name — relation — phone" /></div>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Base Rate (₱)</label>
                    <input className="form-input" type="number" min="0" step="0.01" value={form.base_rate_php} onChange={e => setForm({ ...form, base_rate_php: e.target.value })} placeholder="e.g. 25000" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Rate Period</label>
                    <select className="form-input" value={form.rate_period} onChange={e => setForm({ ...form, rate_period: e.target.value as any })}>
                      {RATE_PERIODS.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                </div>
                <button type="submit" className="btn btn-brand btn-lg w-full" style={{ marginTop: 8 }} disabled={saving}>
                  {saving ? 'Saving…' : (editingEmp ? 'Save Changes' : 'Create Personnel Record')}
                </button>
              </form>
            </div>
          </div>
        </Portal>
      )}
    </div>
  );
}
