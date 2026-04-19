import { useState, useEffect } from 'react';
import { Plus, Wrench, Car, Fuel, User, Search, Activity, X, ChevronRight, Edit, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { formatPHP, fromCents } from '@/lib/formatters';
import { VEHICLE_STATUSES } from '@/lib/status';
import { toast } from 'sonner';
import { Portal } from './ui/Portal';
import { useRealtimeRefresh } from '@/lib/useRealtimeRefresh';
import { usePagination, TablePagination } from '@/lib/usePagination';
import { MaintenancePanel } from './MaintenancePanel';

const VEHICLE_TYPES = ['Van', 'Sedan', 'SUV', 'Coaster', 'Bus'] as const;
const DEFAULT_FORM = {
  model: '',
  plate: '',
  type: 'Van' as (typeof VEHICLE_TYPES)[number],
  capacity: '12',
  fuel: 'Diesel',
  image: '',
  dailyRate: '5000',
};

export function Vehicles() {
  const [vehicleList, setVehicleList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [detailVehicle, setDetailVehicle] = useState<any>(null);
  const [form, setForm] = useState<typeof DEFAULT_FORM>(DEFAULT_FORM);

  useEffect(() => { fetchVehicles(); }, []);
  useRealtimeRefresh('vehicles', () => fetchVehicles());

  const fetchVehicles = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('vehicles').select('*').order('model', { ascending: true });
    if (error) toast.error(`Failed to load vehicles: ${error.message}`);
    if (data) setVehicleList(data);
    setLoading(false);
  };

  const openAddForm = () => {
    setEditingVehicle(null);
    setForm(DEFAULT_FORM);
    setIsFormOpen(true);
  };

  const openEditForm = (v: any) => {
    setEditingVehicle(v);
    setForm({
      model: v.model || '',
      plate: v.plate_number || '',
      type: (v.vehicle_type as any) || 'Van',
      capacity: v.capacity != null ? String(v.capacity) : '12',
      fuel: v.fuel || 'Diesel',
      image: v.image_url || '',
      dailyRate: fromCents(v.daily_rate_cents).toString(),
    });
    setIsFormOpen(true);
    setDetailVehicle(null);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) { toast.error('File too large (Max 2MB)'); return; }
      const reader = new FileReader();
      reader.onloadend = () => setForm(prev => ({ ...prev, image: reader.result as string }));
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const rate = parseFloat(form.dailyRate);
    if (!Number.isFinite(rate) || rate < 0) {
      toast.error('Please enter a valid daily rental rate');
      return;
    }
    const capacity = parseInt(form.capacity, 10);
    if (!Number.isFinite(capacity) || capacity < 1) {
      toast.error('Please enter a valid seating capacity');
      return;
    }

    const vehicleData = {
      model: form.model.trim(),
      plate_number: form.plate.trim().toUpperCase(),
      vehicle_type: form.type,
      image_url: form.image || null,
      capacity,
      fuel: form.fuel,
      daily_rate_cents: Math.round(rate * 100),
    };

    if (editingVehicle) {
      const { error } = await supabase.from('vehicles').update(vehicleData).eq('id', editingVehicle.id);
      if (!error) { toast.success('Vehicle updated'); setIsFormOpen(false); fetchVehicles(); }
      else toast.error(error.message);
    } else {
      const { error } = await supabase.from('vehicles').insert([{ ...vehicleData, status: 'Available' }]);
      if (!error) { toast.success('Vehicle added'); setIsFormOpen(false); fetchVehicles(); }
      else toast.error(error.message);
    }
  };

  const toggleMaintenance = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'Maintenance' ? 'Available' : 'Maintenance';
    const { error } = await supabase.from('vehicles').update({ status: newStatus }).eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success(newStatus === 'Maintenance' ? 'Moved to maintenance' : 'Returned to available');
    fetchVehicles();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this vehicle? This cannot be undone.')) return;
    const { error } = await supabase.from('vehicles').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Vehicle deleted');
    fetchVehicles();
    setDetailVehicle(null);
  };

  const filteredVehicles = vehicleList.filter(v => {
    const q = search.trim().toLowerCase();
    const matchesSearch = !q
      || v.model?.toLowerCase().includes(q)
      || v.plate_number?.toLowerCase().includes(q);
    const matchesType = typeFilter === 'All' || v.vehicle_type === typeFilter;
    const matchesStatus = statusFilter === 'All' || v.status === statusFilter;
    return matchesSearch && matchesType && matchesStatus;
  });
  const pagination = usePagination(filteredVehicles, 12);

  return (
    <div className="space-y-8">
      <div className="page-header">
        <div>
          <h1>Units</h1>
          <p>View and manage all cooperative units.</p>
        </div>
        <button className="btn btn-brand btn-sm" onClick={openAddForm}>
          <Plus size={16} /> Add Vehicle
        </button>
      </div>

      <div className="card" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div className="search-bar" style={{ flex: '1 1 260px', maxWidth: 400 }}>
          <Search className="search-icon" />
          <input placeholder="Filter by plate or model..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="form-select" style={{ width: 'auto', minWidth: 140 }} value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="All">All types</option>
          {VEHICLE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select className="form-select" style={{ width: 'auto', minWidth: 160 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="All">All statuses</option>
          {VEHICLE_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <div className="flex-start gap-4" style={{ marginLeft: 'auto', paddingLeft: 16, borderLeft: '1px solid var(--slate-100)' }}>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--slate-400)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Showing</p>
            <p style={{ fontSize: 18, fontWeight: 700 }}>{filteredVehicles.length} / {vehicleList.length}</p>
          </div>
          <div className="btn-icon" style={{ background: 'var(--slate-50)' }}>
            <Activity size={20} />
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--slate-400)', fontSize: 13 }}>Loading vehicles…</div>
      ) : filteredVehicles.length === 0 ? (
        <div className="card" style={{ padding: 48, textAlign: 'center' }}>
          <Car size={48} style={{ color: 'var(--slate-200)', margin: '0 auto 12px' }} />
          <p style={{ fontWeight: 700 }}>No vehicles match your filters</p>
          <p style={{ fontSize: 12, color: 'var(--slate-400)' }}>Try adjusting type or status.</p>
        </div>
      ) : (
      <div className="vehicle-grid">
        {pagination.items.map((vehicle) => (
          <div className="vehicle-card" key={vehicle.id}>
            <div className="vehicle-image-area">
              {vehicle.image_url ? (
                <img src={vehicle.image_url} alt={vehicle.model} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span className="vehicle-emoji">🚐</span>
              )}
              <div className="vehicle-badge-area">
                <span className={cn('badge', vehicle.status === 'Available' ? 'badge-success' : vehicle.status === 'Maintenance' ? 'badge-warning' : 'badge-info')}>
                  {vehicle.status}
                </span>
              </div>
              <div className="vehicle-gear-btn">
                <button className="btn btn-outline btn-sm" style={{ width: 36, padding: 0 }} onClick={() => setDetailVehicle(vehicle)}>
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
            <div className="vehicle-body">
              <div className="vehicle-title-row">
                <h3 style={{ fontSize: 18, fontWeight: 700 }}>{vehicle.model}</h3>
                <span className="vehicle-plate">{vehicle.plate_number}</span>
              </div>
              <p className="vehicle-ref">Ref: #{vehicle.id?.toString().slice(0, 8)}</p>
              <div className="vehicle-specs">
                <div className="spec-box">
                  <div className="spec-label"><Fuel size={12} /> FUEL</div>
                  <div className="spec-value">{vehicle.fuel || 'Diesel'}</div>
                </div>
                <div className="spec-box">
                  <div className="spec-label"><User size={12} /> SEATS</div>
                  <div className="spec-value">{vehicle.capacity || '12'} Seats</div>
                </div>
              </div>
              <div className="vehicle-actions">
                <button className="btn btn-outline btn-sm flex-1" onClick={() => toggleMaintenance(vehicle.id, vehicle.status)}>
                  <Wrench size={14} />
                  {vehicle.status === 'Maintenance' ? 'Fixed' : 'Repair'}
                </button>
                <button className="btn btn-primary btn-sm" style={{ width: 36, padding: 0 }} onClick={() => setDetailVehicle(vehicle)}>
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
      )}

      {pagination.total > pagination.pageSize && (
        <div className="card" style={{ padding: 0 }}>
          <TablePagination pagination={pagination} label="vehicles" pageSizes={[12, 24, 48]} />
        </div>
      )}

      {/* Add/Edit Modal */}
      {isFormOpen && (
        <Portal>
          <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setIsFormOpen(false); }}>
            <div className="modal modal-md">
              <div className="modal-header">
                <h2>{editingVehicle ? 'Edit Vehicle' : 'Add New Unit'}</h2>
                <button className="modal-close" onClick={() => setIsFormOpen(false)}><X size={20} /></button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="form-group">
                  <label className="form-label">Vehicle Photo</label>
                  <input type="file" id="vehicle-photo-input" hidden accept="image/*" onChange={handleImageUpload} />
                  <div 
                    onClick={() => document.getElementById('vehicle-photo-input')?.click()}
                    style={{ 
                      height: 140, borderRadius: 'var(--radius-lg)', border: '2px dashed var(--slate-200)',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', overflow: 'hidden', background: 'var(--slate-50)', transition: 'all 0.2s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--brand-gold)'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--slate-200)'}
                  >
                    {form.image ? (
                      <img src={form.image} alt="V" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <>
                        <Car size={32} style={{ color: 'var(--slate-300)', marginBottom: 8 }} />
                        <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--slate-400)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Click to upload vehicle photo</p>
                      </>
                    )}
                  </div>
                </div>

                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Model Name</label>
                    <input className="form-input" value={form.model} onChange={e => setForm({ ...form, model: e.target.value })} placeholder="e.g. Toyota Hiace" required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Plate Number</label>
                    <input className="form-input" value={form.plate} onChange={e => setForm({ ...form, plate: e.target.value })} placeholder="ABC-1234" required />
                  </div>
                </div>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Vehicle Type</label>
                    <select className="form-select" value={form.type} onChange={e => setForm({ ...form, type: e.target.value as (typeof VEHICLE_TYPES)[number] })}>
                      {VEHICLE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Seating Capacity</label>
                    <input className="form-input" type="number" value={form.capacity} onChange={e => setForm({ ...form, capacity: e.target.value })} placeholder="12" />
                  </div>
                </div>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Fuel Type</label>
                    <div className="toggle-group">
                      {['Diesel', 'Gasoline', 'Electric'].map(f => (
                        <button key={f} type="button" onClick={() => setForm({ ...form, fuel: f })} className={cn('toggle-btn', form.fuel === f && 'active')}>{f}</button>
                      ))}
                    </div>
                  </div>
                  <div className="form-group">
                     <label className="form-label">Daily Rental Rate (₱)</label>
                     <input 
                        className="form-input" 
                        type="number" 
                        value={form.dailyRate} 
                        onChange={e => setForm({ ...form, dailyRate: e.target.value })} 
                        placeholder="5000" 
                        required 
                     />
                  </div>
                </div>
                <button type="submit" className="btn btn-brand btn-lg w-full" style={{ marginTop: 8 }}>
                  {editingVehicle ? 'Save Changes' : 'Save Unit'}
                </button>
              </form>
            </div>
          </div>
        </Portal>
      )}

      {/* Detail Modal */}
      {detailVehicle && (
        <Portal>
          <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setDetailVehicle(null); }}>
            <div className="modal modal-lg">
              <div className="modal-header">
                <h2>Vehicle Details</h2>
                <button className="modal-close" onClick={() => setDetailVehicle(null)}><X size={20} /></button>
              </div>
              <div className="space-y-6">
                <div style={{ 
                  height: 180, borderRadius: 'var(--radius-lg)', background: 'var(--slate-50)', 
                  display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                  marginBottom: 24
                }}>
                  {detailVehicle.image_url ? (
                    <img src={detailVehicle.image_url} alt={detailVehicle.model} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ fontSize: 64 }}>🚐</div>
                  )}
                </div>
                <div style={{ textAlign: 'center', marginBottom: 24 }}>
                  <h3 style={{ fontSize: 24, fontWeight: 800 }}>{detailVehicle.model}</h3>
                  <p className="vehicle-plate" style={{ display: 'inline-block', marginTop: 8 }}>{detailVehicle.plate_number}</p>
                </div>
                <div className="grid-2">
                  <div className="spec-box"><div className="spec-label">STATUS</div><div className="spec-value">{detailVehicle.status}</div></div>
                  <div className="spec-box"><div className="spec-label">DAILY RATE</div><div className="spec-value">{formatPHP(fromCents(detailVehicle.daily_rate_cents))}</div></div>
                </div>
                <MaintenancePanel vehicleId={detailVehicle.id} vehicleLabel={`${detailVehicle.model} (${detailVehicle.plate_number})`} />
                <div className="modal-footer">
                  <button className="btn btn-outline btn-md flex-1" onClick={() => openEditForm(detailVehicle)}>
                    <Edit size={16} /> Edit
                  </button>
                  <button className="btn btn-danger btn-md flex-1" onClick={() => handleDelete(detailVehicle.id)}>
                    <Trash2 size={16} /> Delete
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
