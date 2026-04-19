import { useState, useEffect, useRef } from 'react';
import { Search, Mail, Phone, MoreVertical, X, Edit, Trash2, RefreshCw, UserRoundCheck } from 'lucide-react';
import { formatDate } from '@/lib/date';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Portal } from './ui/Portal';
import { useRealtimeRefresh } from '@/lib/useRealtimeRefresh';
import { usePagination, TablePagination } from '@/lib/usePagination';

export function Customers() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<any>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', email: '', phone: '', address: '' });
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => { fetchCustomers(); }, []);
  useRealtimeRefresh('profiles', () => fetchCustomers());

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpenMenuId(null);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const fetchCustomers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, contact_number, address, created_at, deactivated_at')
      .eq('role', 'customer')
      .order('created_at', { ascending: false });
    if (error) toast.error(`Couldn't load customers: ${error.message}`);
    if (data) setCustomers(data);
    setLoading(false);
  };

  const openEditForm = (cust: any) => {
    setEditingCustomer(cust);
    setForm({
      name: cust.full_name || '',
      email: cust.email || '',
      phone: cust.contact_number || '',
      address: cust.address || '',
    });
    setIsFormOpen(true);
    setOpenMenuId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCustomer) return;
    const { error } = await supabase.from('profiles').update({
      full_name: form.name.trim(),
      email: form.email.trim(),
      contact_number: form.phone.trim(),
      address: form.address.trim(),
    }).eq('id', editingCustomer.id);
    if (error) { toast.error(error.message); return; }
    toast.success('Customer updated');
    setIsFormOpen(false);
    fetchCustomers();
  };

  const handleReactivatePortal = async (id: string) => {
    setOpenMenuId(null);
    const { error } = await supabase.from('profiles').update({ deactivated_at: null }).eq('id', id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Customer portal access restored. They can sign in again.');
    fetchCustomers();
  };

  const handleDelete = async (id: string) => {
    if (
      !confirm(
        'Delete this customer? Their reservations and billing rows for this account will be removed. Their Supabase login account will remain unless you delete it separately in the Supabase dashboard.'
      )
    )
      return;
    const { error } = await supabase.from('profiles').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Customer deleted');
    fetchCustomers();
    setOpenMenuId(null);
  };

  const filtered = customers.filter(c =>
    c.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase())
  );
  const pagination = usePagination(filtered);

  return (
    <div className="space-y-8">
      <div className="page-header">
        <div>
          <h1>Users</h1>
          <p>View and manage all registered customer accounts.</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-outline btn-sm" onClick={fetchCustomers} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : undefined} /> Refresh
          </button>
        </div>
      </div>

      <div className="card">
        <div className="search-bar mb-6">
          <Search className="search-icon" />
          <input placeholder="Search users..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>User Details</th>
                <th>Contact Info</th>
                <th>Registered</th>
                <th>Status</th>
                <th style={{ width: 50 }}></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: 48, color: 'var(--slate-400)' }}>Loading customers…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: 48, color: 'var(--slate-400)' }}>
                  {search ? 'No customers match your search' : 'No customers registered yet'}
                </td></tr>
              ) : pagination.items.map((cust) => (
                <tr key={cust.id}>
                  <td>
                    <div className="flex-start gap-3">
                      <div className="avatar">{cust.full_name?.[0] || '?'}</div>
                      <div>
                        <p style={{ fontWeight: 600, fontSize: 13 }}>{cust.full_name}</p>
                        <p style={{ fontSize: 11, color: 'var(--slate-400)', marginTop: 2 }}>ID: {cust.id?.toString().slice(0, 8)}</p>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="space-y-2" style={{ fontSize: 11, color: 'var(--slate-500)' }}>
                      <p className="flex-start gap-2"><Mail size={14} style={{ color: 'var(--slate-300)' }} /> {cust.email}</p>
                      <p className="flex-start gap-2"><Phone size={14} style={{ color: 'var(--slate-300)' }} /> {cust.contact_number || 'No phone'}</p>
                    </div>
                  </td>
                  <td>
                    <div style={{ fontSize: 11, color: 'var(--slate-400)' }}>
                      <p style={{ fontWeight: 600, color: 'var(--slate-600)', marginBottom: 2 }}>Joined</p>
                      <p>{formatDate(cust.created_at)}</p>
                    </div>
                  </td>
                  <td>
                    {cust.deactivated_at ? (
                      <span className="badge badge-warning" title={cust.deactivated_at}>
                        Portal deactivated
                      </span>
                    ) : (
                      <span className="badge badge-success">Portal active</span>
                    )}
                  </td>
                  <td style={{ position: 'relative' }}>
                    <button className="btn-icon" onClick={() => setOpenMenuId(openMenuId === cust.id ? null : cust.id)}>
                      <MoreVertical size={16} />
                    </button>
                    {openMenuId === cust.id && (
                      <div className="dropdown-menu" ref={menuRef}>
                        <button className="dropdown-item" onClick={() => openEditForm(cust)}>
                          <Edit size={14} /> Edit Customer
                        </button>
                        {cust.deactivated_at && (
                          <button
                            className="dropdown-item"
                            onClick={() => {
                              if (confirm('Restore this customer’s access to the customer portal? They will be able to sign in again.')) {
                                handleReactivatePortal(cust.id);
                              }
                            }}
                          >
                            <UserRoundCheck size={14} /> Reactivate portal
                          </button>
                        )}
                        <div className="dropdown-separator" />
                        <button className="dropdown-item danger" onClick={() => handleDelete(cust.id)}>
                          <Trash2 size={14} /> Delete Customer
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <TablePagination pagination={pagination} label="customers" />
        </div>
      </div>

      {/* Add/Edit Modal */}
      {isFormOpen && (
        <Portal>
          <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setIsFormOpen(false); }}>
            <div className="modal modal-md">
              <div className="modal-header">
                <h2>Edit Customer</h2>
                <button className="modal-close" onClick={() => setIsFormOpen(false)}><X size={20} /></button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="form-group">
                  <label className="form-label">Full Name</label>
                  <input className="form-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Enter full name" required />
                </div>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Email</label>
                    <input className="form-input" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="email@example.com" required />
                    <p style={{ fontSize: 11, color: 'var(--slate-400)', marginTop: 4 }}>Only updates the display email; Supabase login email must be changed by the user.</p>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Phone</label>
                    <input className="form-input" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="09## ### ####" />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Address</label>
                  <input className="form-input" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="Full address" />
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-outline btn-md flex-1" onClick={() => setIsFormOpen(false)}>Cancel</button>
                  <button type="submit" className="btn btn-brand btn-md flex-1">Save Changes</button>
                </div>
              </form>
            </div>
          </div>
        </Portal>
      )}
    </div>
  );
}
