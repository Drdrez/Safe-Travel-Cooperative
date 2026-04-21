import { useState, useEffect } from 'react';
import { Plus, Search, Calendar, MapPin, Navigation, X, Hash, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { formatPHP, fromCents } from '@/lib/formatters';
import { formatDate } from '@/lib/date';
import { RESERVATION_STATUSES, badgeForReservation, type ReservationStatus } from '@/lib/status';
import { toast } from 'sonner';
import { Portal } from './ui/Portal';
import { AuditTimeline } from './AuditTimeline';
import { useRealtimeRefresh } from '@/lib/useRealtimeRefresh';
import { usePagination, TablePagination } from '@/lib/usePagination';
import { ReservationBookingPanel } from './ReservationBookingPanel';

export function Reservations() {
  const [reservationList, setReservationList] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [detailRes, setDetailRes] = useState<any>(null);

  const [newRes, setNewRes] = useState({
    customer_id: '', vehicle_id: '', pickup: '', destination: '',
    startDate: '', endDate: '', cost: '', tripType: 'Round Trip', customer_special_requests: '',
  });

  useEffect(() => { fetchData(); }, []);
  useRealtimeRefresh(['reservations', 'vehicles', 'reservation_messages'], () => fetchData());

  useEffect(() => {
    setDetailRes((prev: any) => {
      if (!prev?.id) return prev;
      const row = reservationList.find((r) => r.id === prev.id);
      return row ?? prev;
    });
  }, [reservationList]);

  const fetchData = async () => {
    setLoading(true);
    const { data: resData } = await supabase.from('reservations')
      .select('*, profiles!reservations_customer_id_fkey(full_name), vehicles(model, plate_number)')
      .order('created_at', { ascending: false });
    if (resData) setReservationList(resData);
    const { data: custData } = await supabase.from('profiles').select('id, full_name').eq('role', 'customer');
    if (custData) setCustomers(custData);
    const { data: vehData } = await supabase
      .from('vehicles')
      .select('id, model, plate_number, status')
      .eq('status', 'Available');
    if (vehData) setVehicles(vehData);
    setLoading(false);
  };

  const checkVehicleAvailability = async (
    vehicleId: string,
    startIso: string,
    endIso: string,
    excludeReservationId?: string
  ): Promise<boolean> => {
    let query = supabase
      .from('reservations')
      .select('id')
      .eq('vehicle_id', vehicleId)
      .in('status', ['Pending', 'Confirmed', 'In Progress'])
      .lte('start_date', endIso)
      .gte('end_date', startIso)
      .limit(1);
    if (excludeReservationId) query = query.neq('id', excludeReservationId);
    const { data, error } = await query;
    if (error) {
      toast.error(`Availability check failed: ${error.message}`);
      return false;
    }
    return !data || data.length === 0;
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRes.customer_id || !newRes.startDate || !newRes.endDate) {
      toast.error('Please fill all required fields');
      return;
    }
    const start = new Date(newRes.startDate);
    const end = new Date(newRes.endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      toast.error('Please enter valid dates');
      return;
    }
    if (end <= start) {
      toast.error('End date must be after start date');
      return;
    }

    if (newRes.vehicle_id) {
      const available = await checkVehicleAvailability(
        newRes.vehicle_id,
        start.toISOString(),
        end.toISOString()
      );
      if (!available) {
        toast.error('Selected vehicle is already booked in that window. Pick a different vehicle or date.');
        return;
      }

      const { data: veh } = await supabase
        .from('vehicles').select('status').eq('id', newRes.vehicle_id).single();
      if (veh && ['Maintenance', 'Retired'].includes(veh.status)) {
        toast.error(`Vehicle is currently ${veh.status}. Please choose another.`);
        return;
      }
    }

    const costValue = parseFloat(newRes.cost);
    const costCents = Number.isFinite(costValue) ? Math.round(costValue * 100) : 0;
    const idStr = `RES-${Math.floor(1000 + Math.random() * 9000)}`;
    const { error } = await supabase.from('reservations').insert([{
      reservation_id_str: idStr, customer_id: newRes.customer_id, vehicle_id: newRes.vehicle_id || null,
      pickup_location: newRes.pickup || 'TBD', destination: newRes.destination || 'TBD',
      start_date: start.toISOString(), end_date: end.toISOString(),
      status: 'Pending', estimated_cost_cents: costCents,
      customer_special_requests: newRes.customer_special_requests.trim() || null,
    }]);
    if (error) { toast.error(error.message); return; }
    toast.success('Reservation created');
    setIsFormOpen(false);
    setNewRes({ customer_id: '', vehicle_id: '', pickup: '', destination: '', startDate: '', endDate: '', cost: '', tripType: 'Round Trip', customer_special_requests: '' });
    fetchData();
  };

  const updateStatus = async (id: string, newStatus: ReservationStatus) => {
    const res = reservationList.find(r => r.id === id);

    if (newStatus === 'Confirmed' && res?.vehicle_id) {
      const available = await checkVehicleAvailability(
        res.vehicle_id,
        new Date(res.start_date).toISOString(),
        new Date(res.end_date).toISOString(),
        id
      );
      if (!available) {
        toast.error('Vehicle is already booked for overlapping dates. Reassign or cancel the conflict first.');
        return;
      }
      const { data: veh } = await supabase
        .from('vehicles')
        .select('status')
        .eq('id', res.vehicle_id)
        .maybeSingle();
      if (veh && veh.status !== 'Available') {
        toast.error(
          `This unit is ${veh.status} (e.g. under repair). Pick another vehicle or wait until it is back in service.`,
        );
        return;
      }
    }

    if (newStatus === 'Cancelled' && !confirm(`Cancel reservation ${res?.reservation_id_str}? This cannot be undone.`)) {
      return;
    }

    const { error } = await supabase.from('reservations').update({ status: newStatus }).eq('id', id);
    if (error) { toast.error(`Update failed: ${error.message}`); return; }

    if (newStatus === 'Cancelled') {
      await supabase
        .from('billings')
        .update({ status: 'Cancelled' })
        .eq('reservation_id', id)
        .in('status', ['Pending', 'Pending Confirmation']);
    }

    toast.success(`Status updated to ${newStatus}`);
    fetchData();
    setDetailRes(null);
  };

  const patchDetailReservation = (row: any) => {
    setDetailRes(row);
    setReservationList((list) => list.map((r) => (r.id === row.id ? row : r)));
  };

  const filtered = reservationList.filter(r => {
    const matchesFilter = statusFilter === 'all' || (r.status || '').toLowerCase() === statusFilter;
    const q = search.trim().toLowerCase();
    const matchesSearch = !q ||
      r.reservation_id_str?.toLowerCase().includes(q) ||
      (r.profiles as any)?.full_name?.toLowerCase().includes(q);
    return matchesFilter && matchesSearch;
  });
  const pagination = usePagination(filtered);

  return (
    <div className="space-y-8">
      <div className="page-header">
        <div>
          <h1>Bookings</h1>
          <p>Manage and track all transport reservations.</p>
        </div>
        <button className="btn btn-brand btn-sm" onClick={() => setIsFormOpen(true)}>
          <Plus size={16} /> New Booking
        </button>
      </div>

      <div className="card">
        <div className="flex-between mb-6" style={{ flexWrap: 'wrap', gap: 16 }}>
          <div className="filter-tabs">
            {['All', 'Pending', 'Confirmed', 'In Progress', 'Completed', 'Cancelled'].map(f => (
              <button key={f} onClick={() => setStatusFilter(f.toLowerCase())}
                className={cn('filter-tab', statusFilter === f.toLowerCase() && 'active')}>
                {f}
              </button>
            ))}
          </div>
          <div className="search-bar" style={{ maxWidth: 280 }}>
            <Search className="search-icon" />
            <input placeholder="Search reference or customer..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Customer</th>
                <th>Vehicle</th>
                <th>Schedule</th>
                <th>Cost</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 48, color: 'var(--slate-400)' }}>Loading reservations…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 48, color: 'var(--slate-400)' }}>No bookings match your filters.</td></tr>
              ) : pagination.items.map((res) => (
                <tr key={res.id} style={{ cursor: 'pointer' }} onClick={() => setDetailRes(res)}>
                  <td style={{ fontWeight: 700, fontSize: 12 }}>{res.reservation_id_str}</td>
                  <td>
                    <p style={{ fontWeight: 600, fontSize: 13 }}>{(res.profiles as any)?.full_name || 'Guest'}</p>
                  </td>
                  <td>
                    {res.vehicles ? (
                      <div style={{ fontSize: 12 }}>
                        <p style={{ fontWeight: 500 }}>{(res.vehicles as any).model}</p>
                        <p style={{ color: 'var(--slate-400)' }}>{(res.vehicles as any).plate_number}</p>
                      </div>
                    ) : <span className="badge badge-outline">Unassigned</span>}
                  </td>
                  <td>
                    <div style={{ fontSize: 12 }}>
                      <div className="flex-start gap-2" style={{ color: 'var(--slate-900)' }}>
                        <Calendar size={12} style={{ color: 'var(--slate-300)' }} />
                        {formatDate(res.start_date)}
                      </div>
                      <p style={{ color: 'var(--slate-400)', marginLeft: 20 }}>to {formatDate(res.end_date)}</p>
                    </div>
                  </td>
                  <td style={{ fontWeight: 600 }}>{formatPHP(fromCents(res.estimated_cost_cents))}</td>
                  <td>
                    <span className={cn('badge', badgeForReservation(res.status))}>{res.status}</span>
                  </td>
                  <td>
                    <button className="btn-icon" onClick={(e) => { e.stopPropagation(); setDetailRes(res); }}>
                      <ChevronRight size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <TablePagination pagination={pagination} label="bookings" />
        </div>
      </div>

      {/* Create Modal */}
      {isFormOpen && (
        <Portal>
          <div className="modal-backdrop" onClick={(e) => {
            if (e.target === e.currentTarget) setIsFormOpen(false);
          }}>
            <div className="modal modal-lg">
              <div className="modal-header">
                <h2>New Reservation</h2>
                <button className="modal-close" onClick={() => setIsFormOpen(false)}><X size={20} /></button>
              </div>
              <form onSubmit={handleCreate} className="space-y-6">
                <div className="grid-2" style={{ gap: 24 }}>
                  <div className="space-y-4">
                    <div className="form-group">
                      <label className="form-label">Customer</label>
                      <select className="form-select" value={newRes.customer_id} onChange={e => setNewRes({ ...newRes, customer_id: e.target.value })} required>
                        <option value="">Select customer...</option>
                        {customers.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Trip Type</label>
                      <div className="toggle-group">
                        {['Round Trip', 'One Way'].map(t => (
                          <button key={t} type="button" onClick={() => setNewRes({ ...newRes, tripType: t })}
                            className={cn('toggle-btn', newRes.tripType === t && 'active')}>{t}</button>
                        ))}
                      </div>
                    </div>
                    <div className="grid-2">
                      <div className="form-group">
                        <label className="form-label">Start Date</label>
                        <input className="form-input" type="date" value={newRes.startDate} onChange={e => setNewRes({ ...newRes, startDate: e.target.value })} required />
                      </div>
                      <div className="form-group">
                        <label className="form-label">End Date</label>
                        <input className="form-input" type="date" value={newRes.endDate} onChange={e => setNewRes({ ...newRes, endDate: e.target.value })} required />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="form-group">
                      <label className="form-label">Pickup Location</label>
                      <div className="form-input-wrapper">
                        <MapPin className="form-input-icon" />
                        <input className="form-input has-icon" value={newRes.pickup} onChange={e => setNewRes({ ...newRes, pickup: e.target.value })} placeholder="Pickup address" />
                      </div>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Destination</label>
                      <div className="form-input-wrapper">
                        <Navigation className="form-input-icon" />
                        <input className="form-input has-icon" value={newRes.destination} onChange={e => setNewRes({ ...newRes, destination: e.target.value })} placeholder="Destination address" />
                      </div>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Customer note (optional)</label>
                      <textarea
                        className="form-input"
                        rows={2}
                        value={newRes.customer_special_requests}
                        onChange={(e) => setNewRes({ ...newRes, customer_special_requests: e.target.value })}
                        placeholder="Special requests, passenger count, cargo, occasion…"
                      />
                    </div>
                    <div className="grid-2">
                    <div className="form-group">
                      <label className="form-label">Vehicle</label>
                      <p style={{ fontSize: 11, color: 'var(--slate-500)', marginBottom: 6 }}>
                        Only units marked Available are listed (not under repair or retired).
                      </p>
                      <select className="form-select" value={newRes.vehicle_id} onChange={e => setNewRes({ ...newRes, vehicle_id: e.target.value })}>
                        <option value="">Manual Dispatch</option>
                        {vehicles.map(v => <option key={v.id} value={v.id}>{v.model} - {v.plate_number}</option>)}
                      </select>
                    </div>
                      <div className="form-group">
                        <label className="form-label">Cost (PHP)</label>
                        <div className="form-input-wrapper">
                          <Hash className="form-input-icon" />
                          <input className="form-input has-icon" type="number" value={newRes.cost} onChange={e => setNewRes({ ...newRes, cost: e.target.value })} placeholder="0.00" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-outline btn-md flex-1" onClick={() => setIsFormOpen(false)}>Cancel</button>
                  <button type="submit" className="btn btn-brand btn-md" style={{ flex: 1.5 }}>Create Reservation</button>
                </div>
              </form>
            </div>
          </div>
        </Portal>
      )}

      {/* Detail Modal */}
      {detailRes && (
        <Portal>
          <div className="modal-backdrop" onClick={(e) => {
             if (e.target === e.currentTarget) setDetailRes(null);
          }}>
            <div className="modal modal-xl">
              <div className="modal-header">
                <h2>Reservation {detailRes.reservation_id_str}</h2>
                <button className="modal-close" onClick={() => setDetailRes(null)}><X size={20} /></button>
              </div>
              <div className="space-y-4">
                <div style={{ padding: 20, background: 'var(--slate-50)', borderRadius: 'var(--radius-md)' }}>
                  <div className="grid-2" style={{ gap: 16 }}>
                    <div><p className="form-label">Customer</p><p style={{ fontWeight: 600, fontSize: 13 }}>{(detailRes.profiles as any)?.full_name || 'Guest'}</p></div>
                    <div><p className="form-label">Status</p><span className={cn('badge', badgeForReservation(detailRes.status))}>{detailRes.status}</span></div>
                    <div><p className="form-label">Pickup</p><p style={{ fontSize: 13 }}>{detailRes.pickup_location || 'TBD'}</p></div>
                    <div><p className="form-label">Destination</p><p style={{ fontSize: 13 }}>{detailRes.destination || 'TBD'}</p></div>
                    <div><p className="form-label">Vehicle</p><p style={{ fontSize: 13 }}>
                      {(detailRes.vehicles as any)?.model
                        ? `${(detailRes.vehicles as any).model}${(detailRes.vehicles as any).plate_number ? ` · ${(detailRes.vehicles as any).plate_number}` : ''}`
                        : 'Unassigned'}
                    </p></div>
                    <div><p className="form-label">Start</p><p style={{ fontSize: 13 }}>{formatDate(detailRes.start_date)}</p></div>
                    <div><p className="form-label">End</p><p style={{ fontSize: 13 }}>{formatDate(detailRes.end_date)}</p></div>
                    <div><p className="form-label">Cost</p><p style={{ fontSize: 13, fontWeight: 700 }}>{formatPHP(fromCents(detailRes.estimated_cost_cents))}</p></div>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Update Status</label>
                  <select className="form-select" value={detailRes.status} onChange={e => updateStatus(detailRes.id, e.target.value as ReservationStatus)}>
                    {RESERVATION_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                <ReservationBookingPanel reservation={detailRes} onReservationPatch={patchDetailReservation} />

                <div style={{ paddingTop: 8, borderTop: '1px solid var(--slate-100)' }}>
                  <AuditTimeline reservationId={detailRes.id} />
                </div>
              </div>
            </div>
          </div>
        </Portal>
      )}
    </div>
  );
}
