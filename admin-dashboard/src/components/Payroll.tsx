import { useEffect, useMemo, useState } from 'react';
import { Plus, CheckCircle2, X, Loader2, Calendar, Users, RefreshCw, ChevronRight, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { formatPHP, fromCents, toCents } from '@/lib/formatters';
import { formatDate } from '@/lib/date';
import { useRealtimeRefresh } from '@/lib/useRealtimeRefresh';
import { usePagination, TablePagination } from '@/lib/usePagination';
import { Portal } from './ui/Portal';

type Period = {
  id: string;
  period_start: string;
  period_end: string;
  status: 'Draft' | 'Posted' | 'Cancelled' | string;
  notes: string | null;
  posted_at: string | null;
  created_at: string;
};

type Item = {
  id: string;
  period_id: string;
  employee_id: string;
  base_pay_cents: number;
  overtime_hours: number;
  overtime_pay_cents: number;
  allowances_cents: number;
  deductions_cents: number;
  net_pay_cents: number;
  remarks: string | null;
  profiles?: { full_name: string | null; role: string | null; job_title: string | null } | null;
};

type Employee = {
  id: string;
  full_name: string | null;
  role: string;
  job_title: string | null;
  base_rate_cents: number | null;
  rate_period: string | null;
  employment_status: string | null;
};

const STATUS_TONES: Record<string, string> = {
  Draft: 'badge-warning',
  Posted: 'badge-success',
  Cancelled: 'badge-default',
};

export function Payroll() {
  const [periods, setPeriods] = useState<Period[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<Period | null>(null);
  const [loading, setLoading] = useState(true);
  const [isCreatingPeriod, setIsCreatingPeriod] = useState(false);
  const [newPeriod, setNewPeriod] = useState({ period_start: '', period_end: '', notes: '' });
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchAll(); }, []);
  useRealtimeRefresh(['payroll_periods', 'payroll_items'], () => fetchAll());

  const fetchAll = async () => {
    setLoading(true);
    const [p, i, e] = await Promise.all([
      supabase.from('payroll_periods').select('*').order('period_start', { ascending: false }),
      supabase
        .from('payroll_items')
        .select('id, period_id, employee_id, base_pay_cents, overtime_hours, overtime_pay_cents, allowances_cents, deductions_cents, net_pay_cents, remarks, profiles(full_name, role, job_title)')
        .order('created_at', { ascending: true }),
      supabase.from('profiles').select('id, full_name, role, job_title, base_rate_cents, rate_period, employment_status').in('role', ['admin', 'dispatcher', 'driver']),
    ]);
    if (p.error) toast.error(`Couldn't load periods: ${p.error.message}`);
    else setPeriods((p.data || []) as Period[]);
    if (i.error) toast.error(`Couldn't load payslips: ${i.error.message}`);
    else setItems((i.data || []) as any as Item[]);
    if (e.error) toast.error(`Couldn't load employees: ${e.error.message}`);
    else setEmployees((e.data || []) as Employee[]);
    setLoading(false);
  };

  const createPeriod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPeriod.period_start || !newPeriod.period_end) { toast.error('Pick both dates'); return; }
    if (newPeriod.period_end < newPeriod.period_start) { toast.error('End date is before start date'); return; }
    setSaving(true);
    const { data, error } = await supabase
      .from('payroll_periods')
      .insert([{ period_start: newPeriod.period_start, period_end: newPeriod.period_end, notes: newPeriod.notes || null }])
      .select()
      .single();
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Payroll period created');
    setIsCreatingPeriod(false);
    setNewPeriod({ period_start: '', period_end: '', notes: '' });
    fetchAll();
    setSelectedPeriod(data as Period);
  };

  const autoGenerateItems = async (period: Period) => {
    const existingIds = new Set(items.filter(i => i.period_id === period.id).map(i => i.employee_id));
    const toInsert = employees
      .filter(e => e.employment_status === 'Active' && !existingIds.has(e.id))
      .map(e => ({
        period_id: period.id,
        employee_id: e.id,
        base_pay_cents: e.base_rate_cents || 0,
      }));
    if (!toInsert.length) { toast.message('All active employees already have a payslip for this period.'); return; }
    const { error } = await supabase.from('payroll_items').insert(toInsert);
    if (error) { toast.error(error.message); return; }
    toast.success(`Generated ${toInsert.length} payslip${toInsert.length > 1 ? 's' : ''}.`);
    fetchAll();
  };

  const addEmployee = async (employeeId: string) => {
    if (!selectedPeriod) return;
    const emp = employees.find(e => e.id === employeeId);
    if (!emp) return;
    const { error } = await supabase.from('payroll_items').insert([{
      period_id: selectedPeriod.id,
      employee_id: emp.id,
      base_pay_cents: emp.base_rate_cents || 0,
    }]);
    if (error) { toast.error(error.message); return; }
    toast.success('Payslip added');
    fetchAll();
  };

  const saveItem = async (draft: Item) => {
    setSaving(true);
    const { error } = await supabase.from('payroll_items').update({
      base_pay_cents: draft.base_pay_cents,
      overtime_hours: draft.overtime_hours,
      overtime_pay_cents: draft.overtime_pay_cents,
      allowances_cents: draft.allowances_cents,
      deductions_cents: draft.deductions_cents,
      remarks: draft.remarks,
    }).eq('id', draft.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Payslip updated');
    setEditingItem(null);
    fetchAll();
  };

  const deleteItem = async (id: string) => {
    if (!confirm('Remove this payslip from the period?')) return;
    const { error } = await supabase.from('payroll_items').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Payslip removed');
    fetchAll();
  };

  const postPeriod = async (period: Period) => {
    if (!confirm('Post this payroll period? Employees will be notified and the totals will be locked.')) return;
    const { data: authData } = await supabase.auth.getUser();
    const { error } = await supabase.from('payroll_periods').update({
      status: 'Posted',
      posted_at: new Date().toISOString(),
      posted_by: authData.user?.id || null,
    }).eq('id', period.id);
    if (error) { toast.error(error.message); return; }
    toast.success('Payroll posted — employees notified');
    fetchAll();
  };

  const cancelPeriod = async (period: Period) => {
    if (!confirm('Cancel this payroll period? This cannot be reverted.')) return;
    const { error } = await supabase.from('payroll_periods').update({ status: 'Cancelled' }).eq('id', period.id);
    if (error) { toast.error(error.message); return; }
    toast.success('Period cancelled');
    fetchAll();
  };

  const periodItems = useMemo(() => {
    if (!selectedPeriod) return [];
    return items.filter(i => i.period_id === selectedPeriod.id);
  }, [items, selectedPeriod]);

  const periodTotal = periodItems.reduce((s, i) => s + (i.net_pay_cents || 0), 0);
  const notAddedYet = useMemo(() => {
    if (!selectedPeriod) return [];
    const added = new Set(periodItems.map(i => i.employee_id));
    return employees.filter(e => e.employment_status === 'Active' && !added.has(e.id));
  }, [employees, periodItems, selectedPeriod]);

  const periodsPagination = usePagination(periods);
  const itemsPagination = usePagination(periodItems);

  return (
    <div className="space-y-8">
      <div className="page-header">
        <div><h1>Payroll</h1><p>Declare periods, compute payslips, and post payroll so employees can view their payslip.</p></div>
        <button className="btn btn-brand btn-sm" onClick={() => setIsCreatingPeriod(true)}><Plus size={16} /> New Period</button>
      </div>

      <div className="grid-2" style={{ alignItems: 'start', gap: 24 }}>
        {/* Left: period list */}
        <div className="card" style={{ maxHeight: 640, overflowY: 'auto' }}>
          <div className="flex-between mb-4">
            <h2 style={{ fontSize: 16, fontWeight: 700 }}>Periods</h2>
            <button className="btn-icon" onClick={fetchAll} title="Refresh"><RefreshCw size={16} /></button>
          </div>
          {loading ? (
            <p style={{ color: 'var(--slate-400)', fontSize: 13 }}>Loading…</p>
          ) : periods.length === 0 ? (
            <div className="empty-state" style={{ padding: 24 }}>
              <Calendar size={32} style={{ color: 'var(--slate-300)' }} />
              <p style={{ fontSize: 13, color: 'var(--slate-400)' }}>No payroll periods yet.</p>
            </div>
          ) : periodsPagination.items.map(p => {
            const itemsCount = items.filter(i => i.period_id === p.id).length;
            const total = items.filter(i => i.period_id === p.id).reduce((s, i) => s + i.net_pay_cents, 0);
            const active = selectedPeriod?.id === p.id;
            return (
              <button
                key={p.id}
                onClick={() => setSelectedPeriod(p)}
                className={cn('list-row', active && 'active')}
                style={{ width: '100%', textAlign: 'left', padding: 12, borderRadius: 8, border: `1px solid ${active ? 'var(--brand-gold)' : 'var(--slate-100)'}`, marginBottom: 8, background: active ? 'var(--brand-gold-light)' : 'white', cursor: 'pointer' }}
              >
                <div className="flex-between" style={{ marginBottom: 4 }}>
                  <span style={{ fontWeight: 700, fontSize: 13 }}>{formatDate(p.period_start)} – {formatDate(p.period_end)}</span>
                  <span className={cn('badge', STATUS_TONES[p.status] || 'badge-outline')}>{p.status}</span>
                </div>
                <div className="flex-between" style={{ fontSize: 11, color: 'var(--slate-500)' }}>
                  <span><Users size={11} style={{ verticalAlign: -1 }} /> {itemsCount} payslip{itemsCount === 1 ? '' : 's'}</span>
                  <span style={{ fontWeight: 600 }}>{formatPHP(fromCents(total))}</span>
                </div>
              </button>
            );
          })}
          {periods.length > periodsPagination.pageSize && (
            <TablePagination pagination={periodsPagination} label="periods" pageSizes={[10, 20]} style={{ background: 'transparent', borderTop: '1px solid var(--slate-100)', padding: '8px 0 0' }} />
          )}
        </div>

        {/* Right: selected period detail */}
        <div className="card">
          {!selectedPeriod ? (
            <div className="empty-state" style={{ padding: 60 }}>
              <FileText size={40} style={{ color: 'var(--slate-300)' }} />
              <p style={{ fontSize: 13, color: 'var(--slate-400)', marginTop: 8 }}>Select a period to manage payslips.</p>
            </div>
          ) : (
            <>
              <div className="flex-between" style={{ marginBottom: 16 }}>
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 800 }}>{formatDate(selectedPeriod.period_start)} – {formatDate(selectedPeriod.period_end)}</h2>
                  <p style={{ fontSize: 12, color: 'var(--slate-500)' }}>{selectedPeriod.notes || 'No notes'}</p>
                </div>
                <div className="flex-start gap-2">
                  <span className={cn('badge', STATUS_TONES[selectedPeriod.status] || 'badge-outline')}>{selectedPeriod.status}</span>
                </div>
              </div>

              {selectedPeriod.status === 'Draft' && (
                <div className="flex-start gap-2 mb-4" style={{ flexWrap: 'wrap' }}>
                  <button className="btn btn-outline btn-sm" onClick={() => autoGenerateItems(selectedPeriod)}>
                    <Plus size={14} /> Auto-generate for active staff
                  </button>
                  {notAddedYet.length > 0 && (
                    <select className="form-input" style={{ maxWidth: 260 }} defaultValue="" onChange={(e) => { if (e.target.value) { addEmployee(e.target.value); e.target.value = ''; } }}>
                      <option value="">+ Add individual employee</option>
                      {notAddedYet.map(emp => <option key={emp.id} value={emp.id}>{emp.full_name || 'Unnamed'} — {emp.role}</option>)}
                    </select>
                  )}
                </div>
              )}

              <div className="table-wrapper">
                <table className="data-table">
                  <thead><tr><th>Employee</th><th>Base</th><th>OT hrs</th><th>OT pay</th><th>Allow.</th><th>Deduct.</th><th>Net</th><th></th></tr></thead>
                  <tbody>
                    {periodItems.length === 0 ? (
                      <tr><td colSpan={8} style={{ textAlign: 'center', padding: 32, color: 'var(--slate-400)' }}>No payslips yet.</td></tr>
                    ) : itemsPagination.items.map(i => (
                      <tr key={i.id}>
                        <td>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{i.profiles?.full_name || '—'}</div>
                          <div style={{ fontSize: 11, color: 'var(--slate-400)' }}>{i.profiles?.job_title || i.profiles?.role}</div>
                        </td>
                        <td style={{ fontSize: 12 }}>{formatPHP(fromCents(i.base_pay_cents))}</td>
                        <td style={{ fontSize: 12 }}>{Number(i.overtime_hours).toFixed(2)}</td>
                        <td style={{ fontSize: 12 }}>{formatPHP(fromCents(i.overtime_pay_cents))}</td>
                        <td style={{ fontSize: 12 }}>{formatPHP(fromCents(i.allowances_cents))}</td>
                        <td style={{ fontSize: 12, color: 'var(--rose-600)' }}>−{formatPHP(fromCents(i.deductions_cents))}</td>
                        <td style={{ fontSize: 13, fontWeight: 700 }}>{formatPHP(fromCents(i.net_pay_cents))}</td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          {selectedPeriod.status === 'Draft' ? (
                            <div className="flex-start gap-1">
                              <button className="btn btn-outline btn-xs" onClick={() => setEditingItem(i)}>Edit</button>
                              <button className="btn btn-outline btn-xs" style={{ color: 'var(--rose-600)' }} onClick={() => deleteItem(i.id)}>Remove</button>
                            </div>
                          ) : (
                            <span style={{ fontSize: 11, color: 'var(--slate-400)' }}>locked</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <TablePagination pagination={itemsPagination} label="payslips" />
              </div>

              <div className="flex-between" style={{ padding: '16px 4px', borderTop: '1px solid var(--slate-100)', marginTop: 12 }}>
                <span style={{ fontSize: 13, color: 'var(--slate-500)' }}>Period total</span>
                <span style={{ fontSize: 20, fontWeight: 800 }}>{formatPHP(fromCents(periodTotal))}</span>
              </div>

              {selectedPeriod.status === 'Draft' && periodItems.length > 0 && (
                <div className="flex-start gap-2" style={{ marginTop: 12 }}>
                  <button className="btn btn-primary btn-md" onClick={() => postPeriod(selectedPeriod)}><CheckCircle2 size={14} /> Post Payroll</button>
                  <button className="btn btn-outline btn-md" onClick={() => cancelPeriod(selectedPeriod)} style={{ color: 'var(--rose-600)' }}>Cancel Period</button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* New period modal */}
      {isCreatingPeriod && (
        <Portal>
          <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setIsCreatingPeriod(false); }}>
            <div className="modal modal-md">
              <div className="modal-header">
                <h2>New Payroll Period</h2>
                <button className="modal-close" onClick={() => setIsCreatingPeriod(false)}><X size={20} /></button>
              </div>
              <form onSubmit={createPeriod} className="space-y-4">
                <div className="grid-2">
                  <div className="form-group"><label className="form-label">Period Start</label><input className="form-input" type="date" required value={newPeriod.period_start} onChange={e => setNewPeriod({ ...newPeriod, period_start: e.target.value })} /></div>
                  <div className="form-group"><label className="form-label">Period End</label><input className="form-input" type="date" required value={newPeriod.period_end} onChange={e => setNewPeriod({ ...newPeriod, period_end: e.target.value })} /></div>
                </div>
                <div className="form-group"><label className="form-label">Notes</label><input className="form-input" value={newPeriod.notes} onChange={e => setNewPeriod({ ...newPeriod, notes: e.target.value })} placeholder="e.g. 2nd half September 2026" /></div>
                <button type="submit" className="btn btn-brand btn-lg w-full" disabled={saving}>
                  {saving ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : 'Create Period'}
                </button>
              </form>
            </div>
          </div>
        </Portal>
      )}

      {/* Edit item modal */}
      {editingItem && (
        <Portal>
          <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setEditingItem(null); }}>
            <div className="modal modal-md">
              <div className="modal-header">
                <h2>Edit Payslip — {editingItem.profiles?.full_name}</h2>
                <button className="modal-close" onClick={() => setEditingItem(null)}><X size={20} /></button>
              </div>
              <ItemForm item={editingItem} onCancel={() => setEditingItem(null)} onSave={saveItem} saving={saving} />
            </div>
          </div>
        </Portal>
      )}
    </div>
  );
}

function ItemForm({ item, onCancel, onSave, saving }: { item: Item; onCancel: () => void; onSave: (i: Item) => void; saving: boolean }) {
  const [basePhp, setBasePhp] = useState(String(fromCents(item.base_pay_cents)));
  const [otHrs, setOtHrs] = useState(String(item.overtime_hours));
  const [otPhp, setOtPhp] = useState(String(fromCents(item.overtime_pay_cents)));
  const [allowPhp, setAllowPhp] = useState(String(fromCents(item.allowances_cents)));
  const [dedPhp, setDedPhp] = useState(String(fromCents(item.deductions_cents)));
  const [remarks, setRemarks] = useState(item.remarks || '');

  const preview =
    toCents(Number(basePhp || 0)) +
    toCents(Number(otPhp || 0)) +
    toCents(Number(allowPhp || 0)) -
    toCents(Number(dedPhp || 0));

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSave({
          ...item,
          base_pay_cents: toCents(Number(basePhp || 0)),
          overtime_hours: Number(otHrs || 0),
          overtime_pay_cents: toCents(Number(otPhp || 0)),
          allowances_cents: toCents(Number(allowPhp || 0)),
          deductions_cents: toCents(Number(dedPhp || 0)),
          remarks: remarks || null,
        });
      }}
    >
      <div className="grid-2">
        <div className="form-group"><label className="form-label">Base Pay (₱)</label><input className="form-input" type="number" min="0" step="0.01" value={basePhp} onChange={e => setBasePhp(e.target.value)} /></div>
        <div className="form-group"><label className="form-label">Overtime Hours</label><input className="form-input" type="number" min="0" step="0.25" value={otHrs} onChange={e => setOtHrs(e.target.value)} /></div>
      </div>
      <div className="grid-2">
        <div className="form-group"><label className="form-label">Overtime Pay (₱)</label><input className="form-input" type="number" min="0" step="0.01" value={otPhp} onChange={e => setOtPhp(e.target.value)} /></div>
        <div className="form-group"><label className="form-label">Allowances (₱)</label><input className="form-input" type="number" min="0" step="0.01" value={allowPhp} onChange={e => setAllowPhp(e.target.value)} /></div>
      </div>
      <div className="grid-2">
        <div className="form-group"><label className="form-label">Deductions (₱)</label><input className="form-input" type="number" min="0" step="0.01" value={dedPhp} onChange={e => setDedPhp(e.target.value)} /></div>
        <div className="form-group">
          <label className="form-label">Net Preview</label>
          <div style={{ padding: '12px 16px', background: 'var(--slate-50)', borderRadius: 'var(--radius-md)', fontWeight: 700 }}>
            {formatPHP(fromCents(preview))}
          </div>
        </div>
      </div>
      <div className="form-group"><label className="form-label">Remarks</label><input className="form-input" value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Optional" /></div>
      <div className="flex-start gap-2">
        <button type="button" className="btn btn-outline btn-md" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn-brand btn-md" disabled={saving}>{saving ? 'Saving…' : 'Save Payslip'}</button>
      </div>
    </form>
  );
}
