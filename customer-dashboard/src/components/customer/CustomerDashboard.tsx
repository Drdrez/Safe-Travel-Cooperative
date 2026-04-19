import { useState, useEffect } from 'react';
import { Calendar, CreditCard, CheckCircle2, MapPin, ArrowRight, User, Zap, ChevronRight, Car, Navigation, X, Clock, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { formatPHP } from '../../lib/utils';
import { formatDate } from '../../lib/date';
import { supabase } from '../../lib/supabase';
import { useRealtimeRefresh } from '../../lib/useRealtimeRefresh';
import { Portal } from '../ui/Portal';

export default function CustomerDashboard() {
  const navigate = useNavigate();
  const [customer, setCustomer] = useState<any>(null);
  const [metrics, setMetrics] = useState({ active: 0, completed: 0, totalSpent: 0 });
  const [recentRes, setRecentRes] = useState<any>(null);
  const [selectedRes, setSelectedRes] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setUserId(data.user?.id ?? null);
    })();
    fetchCustomerData();
  }, []);

  // Keep the overview card, metrics, and recent trip card fresh without a refresh.
  useRealtimeRefresh(
    ['reservations', 'billings'],
    () => fetchCustomerData(),
    { filter: userId ? `customer_id=eq.${userId}` : undefined, enabled: !!userId, debounceMs: 250 },
  );

  const fetchCustomerData = async () => {
    setLoading(true);
    const { data: authData } = await supabase.auth.getUser();
    const user = authData.user;

    if (!user) {
        navigate('/login');
        return;
    }

    const { data: profile, error: pErr } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    if (pErr && pErr.code !== 'PGRST116') {
      // PGRST116 = no rows; harmless for brand-new signups
      toast.error(`Couldn't load profile: ${pErr.message}`);
    }

    const displayName = profile?.full_name || user.user_metadata?.full_name || 'Guest';
    setCustomer({ ...(profile || {}), full_name: displayName });

    const { data: reservations, error: rErr } = await supabase
      .from('reservations')
      .select('*, vehicles(*)')
      .eq('customer_id', user.id)
      .order('created_at', { ascending: false }) as { data: any[] | null; error: any };
    if (rErr) toast.error(`Couldn't load reservations: ${rErr.message}`);

    if (reservations && reservations.length > 0) {
        setRecentRes(reservations[0]);
        setMetrics({
            active: reservations.filter((r: any) => ['Pending', 'Confirmed', 'In Progress'].includes(r.status)).length,
            completed: reservations.filter((r: any) => r.status === 'Completed').length,
            totalSpent: reservations.filter((r: any) => r.status === 'Completed').reduce((acc: number, r: any) => acc + (r.estimated_cost_cents || 0), 0) / 100
        });
    }
    setLoading(false);
  };

  const stats = [
    { title: 'Active Trips', value: metrics.active, sub: 'Confirmed bookings', icon: MapPin, color: 'var(--brand-gold)', bg: 'var(--brand-gold-light)' },
    { title: 'Total Trips', value: metrics.completed, sub: 'Safely completed', icon: CheckCircle2, color: 'var(--emerald-500)', bg: 'var(--emerald-50)' },
    { title: 'Total Paid', value: formatPHP(metrics.totalSpent), sub: 'Lifetime spending', icon: CreditCard, color: 'var(--indigo-600)', bg: 'var(--indigo-50)' },
  ];

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 80, gap: 12, color: 'var(--slate-400)' }}>
        <Loader2 size={18} className="animate-spin" /> Loading your dashboard…
      </div>
    );
  }

  return (
    <div className="space-y-10 animate-in fade-in duration-700" style={{ paddingBottom: 60 }}>
      {/* Welcome Header */}
      <div
        className="card customer-dashboard-hero"
        style={{
          background: 'var(--slate-900)',
          border: 'none',
          padding: '40px 48px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{ position: 'relative', zIndex: 1, minWidth: 0 }}>
          <h1 style={{ color: 'white', marginBottom: 12 }}>Hello, {customer?.full_name?.split(' ')[0] || 'Guest'}!</h1>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 18, fontWeight: 500 }}>
            {metrics.active > 0 
                ? <>You have <strong style={{ color: 'var(--brand-gold)' }}>{metrics.active} active trips</strong> scheduled. Safe travels!</>
                : <>Ready for your next journey? Book a premium ride today.</>
            }
          </p>
        </div>
        <div style={{ position: 'relative', zIndex: 1, flexShrink: 0 }}>
          <button className="btn btn-brand btn-lg" onClick={() => navigate('/customer/make-reservation')}>
            <Calendar size={20} /> Book New Trip
          </button>
        </div>
        <div style={{ 
            position: 'absolute', right: -40, top: -40, width: 300, height: 300, 
            background: 'radial-gradient(circle, rgba(234, 179, 8, 0.1) 0%, transparent 70%)',
            pointerEvents: 'none'
        }} />
      </div>

      {/* Stats Row */}
      <div className="grid-3">
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <div 
              className="card" 
              key={stat.title} 
              onClick={() => i < 2 && navigate('/customer/reservations')}
              style={{ 
                animationDelay: `${i * 100}ms`, padding: '24px 28px', 
                cursor: i < 2 ? 'pointer' : 'default', transition: 'all 0.2s' 
              }}
            >
              <div className="flex-between" style={{ marginBottom: 20 }}>
                <div style={{ 
                  width: 48, height: 48, borderRadius: 12, background: stat.bg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <Icon size={24} style={{ color: stat.color }} />
                </div>
              </div>
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--slate-500)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{stat.title}</p>
                <h2 style={{ fontSize: 28, fontWeight: 800 }}>{stat.value}</h2>
                <p style={{ fontSize: 12, color: 'var(--slate-400)', marginTop: 8, fontWeight: 600 }}>{stat.sub}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Recent Activity Section */}
      {recentRes && (
        <div className="space-y-6">
            <h3 style={{ fontSize: 18, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 12 }}>
                <Zap size={20} className="text-brand-gold" /> Recent Activity
            </h3>
            <div className="card customer-dashboard-recent">
                <div className="customer-dashboard-recent-media">
                    {recentRes.vehicles?.image_url ? (
                        <img src={recentRes.vehicles.image_url} alt="V" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--slate-100)', color: 'var(--slate-300)' }}>
                            <Car size={64} />
                        </div>
                    )}
                    <div style={{ position: 'absolute', top: 16, left: 16 }}>
                        <span className={`status-badge status-badge-${(recentRes.status || 'pending').toLowerCase()}`}>
                            {recentRes.status || 'Pending'}
                        </span>
                    </div>
                </div>
                <div className="customer-dashboard-recent-body">
                    <div className="flex-between customer-trip-header" style={{ marginBottom: 24 }}>
                        <div>
                            <p style={{ fontSize: 11, fontWeight: 800, color: 'var(--slate-400)', textTransform: 'uppercase', marginBottom: 4 }}>Trip Reference</p>
                            <h4 style={{ fontSize: 20, fontWeight: 800 }}>{recentRes.reservation_id_str}</h4>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <p style={{ fontSize: 11, fontWeight: 800, color: 'var(--slate-400)', textTransform: 'uppercase', marginBottom: 4 }}>Vehicle Assigned</p>
                            <p style={{ fontSize: 16, fontWeight: 700 }}>{recentRes.vehicles?.model || 'Pending Assignment'}</p>
                        </div>
                    </div>
                    
                    <div className="grid-2" style={{ gap: 32, marginBottom: 32 }}>
                        <div className="flex-start" style={{ gap: 12 }}>
                            <MapPin size={18} className="text-slate-400" />
                            <div>
                                <p style={{ fontSize: 11, color: 'var(--slate-400)' }}>Pickup</p>
                                <p style={{ fontWeight: 600 }}>{recentRes.pickup_location}</p>
                            </div>
                        </div>
                        <div className="flex-start" style={{ gap: 12 }}>
                            <Navigation size={18} className="text-brand-gold" />
                            <div>
                                <p style={{ fontSize: 11, color: 'var(--slate-400)' }}>Destination</p>
                                <p style={{ fontWeight: 600 }}>{recentRes.destination}</p>
                            </div>
                        </div>
                    </div>

                    <div className="customer-trip-actions">
                        <button onClick={() => navigate('/customer/tracking')} className="btn btn-brand" style={{ height: 48, padding: '0 24px' }}>
                            Track This Trip
                        </button>
                        <button onClick={() => setSelectedRes(recentRes)} className="btn btn-outline" style={{ height: 48 }}>
                            Trip Details
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* Quick Details Modal */}
      {selectedRes && (
        <Portal>
          <div className="modal-backdrop">
             <div className="modal" style={{ maxWidth: 500, padding: 0, overflow: 'hidden' }}>
                <div style={{ background: 'var(--slate-900)', padding: 32, color: 'white', position: 'relative' }}>
                    <button 
                        onClick={() => setSelectedRes(null)} 
                        style={{ position: 'absolute', top: 24, right: 24, color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.05)', padding: 8, borderRadius: '50%' }}
                    >
                        <X size={18} />
                    </button>
                    <p style={{ fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', marginBottom: 8 }}>Booking Record</p>
                    <h2 style={{ color: 'white', fontSize: 24 }}>{selectedRes.reservation_id_str}</h2>
                    <div style={{ marginTop: 16 }}>
                        <span className={`status-badge status-badge-${(selectedRes.status || 'pending').toLowerCase()}`}>
                            {selectedRes.status || 'Pending'}
                        </span>
                    </div>
                </div>

                <div style={{ padding: 32 }} className="space-y-6">
                    <div className="customer-modal-grid-2">
                        <div className="flex-start" style={{ gap:12 }}>
                            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--slate-50)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <MapPin size={18} className="text-slate-400" />
                            </div>
                            <div>
                                <p style={{ fontSize: 11, color: 'var(--slate-400)', textTransform: 'uppercase', fontWeight: 700 }}>Pickup</p>
                                <p style={{ fontWeight: 700, fontSize: 14 }}>{selectedRes.pickup_location}</p>
                            </div>
                        </div>
                        <div className="flex-start" style={{ gap:12 }}>
                            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--brand-gold-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Navigation size={18} className="text-brand-gold" />
                            </div>
                            <div>
                                <p style={{ fontSize: 11, color: 'var(--slate-400)', textTransform: 'uppercase', fontWeight: 700 }}>Destination</p>
                                <p style={{ fontWeight: 700, fontSize: 14 }}>{selectedRes.destination}</p>
                            </div>
                        </div>
                    </div>

                    <div className="customer-modal-grid-2" style={{ padding: '24px 0', borderTop: '1px solid var(--slate-100)', borderBottom: '1px solid var(--slate-100)' }}>
                        <div>
                            <p style={{ fontSize: 11, color: 'var(--slate-400)', textTransform: 'uppercase', fontWeight: 700, marginBottom: 4 }}>Schedule</p>
                            <div className="flex-start" style={{ gap: 8 }}>
                                <Clock size={16} className="text-brand-gold" />
                                <p style={{ fontWeight: 700, fontSize: 14 }}>{formatDate(selectedRes.start_date)}</p>
                            </div>
                        </div>
                        <div>
                            <p style={{ fontSize: 11, color: 'var(--slate-400)', textTransform: 'uppercase', fontWeight: 700, marginBottom: 4 }}>Assigned Vehicle</p>
                            <div className="flex-start" style={{ gap: 8 }}>
                                <Car size={16} className="text-slate-400" />
                                <p style={{ fontWeight: 700, fontSize: 14 }}>{selectedRes.vehicles?.model || 'Awaiting Driver'}</p>
                            </div>
                        </div>
                    </div>

                    <div style={{ padding: 20, background: 'var(--slate-50)', borderRadius: 16 }}>
                        <div className="flex-between">
                            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--slate-500)' }}>Total Estimated Cost</span>
                            <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--slate-900)' }}>{formatPHP((selectedRes.estimated_cost_cents || 0) / 100)}</span>
                        </div>
                    </div>

                    <div className="customer-modal-footer-row">
                        <button onClick={() => setSelectedRes(null)} className="btn btn-outline">Close</button>
                        <button onClick={() => navigate('/customer/tracking')} className="btn btn-brand" style={{ flex: '1.5 1 200px' }}>Track Live</button>
                    </div>
                </div>
             </div>
          </div>
        </Portal>
      )}

      <div className="grid-2">
        {/* Support Card */}
        <div className="card" style={{ padding: 32, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ 
                width: 56, height: 56, borderRadius: '50%', background: 'var(--slate-50)', 
                display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20
            }}>
                <User size={28} style={{ color: 'var(--slate-400)' }} />
            </div>
            <h2 style={{ fontSize: 20, marginBottom: 8 }}>Need Support?</h2>
            <p style={{ color: 'var(--slate-500)', fontSize: 14, marginBottom: 24, lineHeight: 1.6 }}>
                Our support staff is available 24/7 for your travel needs. We're here to help you move safely.
            </p>
            <div className="flex-start customer-trip-actions" style={{ gap: 16 }}>
                <button className="btn btn-outline" onClick={() => navigate('/customer/support')}>Contact Support</button>
                <button className="btn btn-ghost" style={{ fontWeight: 700 }} onClick={() => navigate('/customer/support')}>View FAQ <ChevronRight size={16} /></button>
            </div>
        </div>

        {/* Info Card */}
        <div className="card" style={{ padding: 32, background: 'var(--brand-gold-light)', border: '1px solid var(--brand-gold)' }}>
            <div style={{ 
                width: 56, height: 56, borderRadius: '16px', background: 'white', 
                display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20,
                boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
            }}>
                <Zap size={28} className="text-brand-gold" />
            </div>
            <h2 style={{ fontSize: 20, marginBottom: 8, color: 'var(--brand-gold-dark)' }}>Travel with Comfort</h2>
            <p style={{ color: 'var(--brand-gold-dark)', opacity: 0.8, fontSize: 14, marginBottom: 24, lineHeight: 1.6 }}>
                Rent a premium vehicle with a professional driver. Our service with a professional driver ensures you reach your destination in comfort and safety.
            </p>
            <button className="btn btn-brand" onClick={() => navigate('/customer/make-reservation')}>
                Start Booking <ArrowRight size={18} />
            </button>
        </div>
      </div>
    </div>
  );
}