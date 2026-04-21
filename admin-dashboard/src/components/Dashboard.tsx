import { useState, useEffect } from 'react';
import {
  TrendingUp, Users, Calendar, Car, ArrowUpRight, Activity, BarChart3,
  ChevronRight, AlertTriangle, MessageSquare, RotateCcw, Wallet, Inbox,
} from 'lucide-react';
import { formatPHP, fromCents } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useRealtimeRefresh } from '@/lib/useRealtimeRefresh';
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, LabelList,
} from 'recharts';

type InboxItem = {
  id: string;
  label: string;
  count: number;
  icon: any;
  tone: 'gold' | 'indigo' | 'emerald' | 'rose' | 'sky';
  navTo: string;
  cta: string;
};

export default function Dashboard({ onNavigate }: { onNavigate: (id: string) => void }) {
  const [period, setPeriod] = useState<'weekly' | 'monthly' | 'yearly'>('weekly');
  const [metrics, setMetrics] = useState({ income: 0, units: 0, users: 0, requests: 0 });
  const [revenueHistory, setRevenueHistory] = useState<any[]>([]);
  const [statusBreakdown, setStatusBreakdown] = useState<Array<{ name: string; value: number; color: string }>>([]);
  const [inbox, setInbox] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  useRealtimeRefresh(
    ['reservations', 'billings', 'support_tickets', 'profiles', 'vehicles'],
    () => fetchDashboardData(),
    { debounceMs: 400 },
  );

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const YEARS_BACK = 5;
      const now = new Date();
      let windowStart: Date;
      if (period === 'weekly') {
        windowStart = new Date();
        windowStart.setHours(0, 0, 0, 0);
        windowStart.setDate(windowStart.getDate() - 6);
      } else if (period === 'monthly') {
        windowStart = new Date(now.getFullYear(), now.getMonth() - 11, 1, 0, 0, 0, 0);
      } else {
        windowStart = new Date(now.getFullYear() - (YEARS_BACK - 1), 0, 1, 0, 0, 0, 0);
      }
      const windowIso = windowStart.toISOString();

      const [
        { data: paidBillings, error: incomeErr },
        { count: unitsCount },
        { count: usersCount },
        { count: requestsCount },
        { data: volData, error: volErr },
        { count: pendingReservationsCount },
        { count: pendingConfirmationCount },
        { count: refundPendingCount },
        { count: overdueCount },
        { count: openTicketCount },
      ] = await Promise.all([
        supabase
          .from('billings')
          .select('amount_cents, paid_at, confirmed_at, created_at, status'),
        supabase.from('vehicles').select('*', { count: 'exact', head: true }).eq('status', 'Available'),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'customer'),
        supabase.from('reservations').select('*', { count: 'exact', head: true }).eq('status', 'Pending'),
        supabase
          .from('reservations')
          .select('status, start_date, created_at')
          .gte('created_at', windowIso),

        supabase.from('reservations')
          .select('*', { count: 'exact', head: true }).eq('status', 'Pending'),
        supabase.from('billings')
          .select('*', { count: 'exact', head: true }).eq('status', 'Pending Confirmation'),
        supabase.from('billings')
          .select('*', { count: 'exact', head: true }).eq('refund_status', 'Pending'),
        supabase.from('billings')
          .select('*', { count: 'exact', head: true }).eq('status', 'Overdue'),
        supabase.from('support_tickets')
          .select('*', { count: 'exact', head: true }).in('status', ['Open', 'In Progress']),
      ]);

      if (incomeErr) toast.error(`Revenue load failed: ${incomeErr.message}`);
      if (volErr) toast.error(`Booking-volume load failed: ${volErr.message}`);

      const paidRows = (paidBillings || []).filter(b => b.status === 'Paid');

      const buckets: Array<{ name: string; income: number }> = [];
      const ranges: Array<{ start: number; end: number }> = [];

      if (period === 'weekly') {
        for (let i = 6; i >= 0; i--) {
          const dayStart = new Date();
          dayStart.setHours(0, 0, 0, 0);
          dayStart.setDate(dayStart.getDate() - i);
          const dayEnd = new Date(dayStart);
          dayEnd.setHours(23, 59, 59, 999);
          buckets.push({ name: dayStart.toLocaleDateString(undefined, { weekday: 'short' }), income: 0 });
          ranges.push({ start: dayStart.getTime(), end: dayEnd.getTime() });
        }
      } else if (period === 'monthly') {
        for (let i = 11; i >= 0; i--) {
          const start = new Date(now.getFullYear(), now.getMonth() - i, 1, 0, 0, 0, 0);
          const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999);
          buckets.push({ name: start.toLocaleDateString(undefined, { month: 'short' }), income: 0 });
          ranges.push({ start: start.getTime(), end: end.getTime() });
        }
      } else {
        for (let i = YEARS_BACK - 1; i >= 0; i--) {
          const year = now.getFullYear() - i;
          const start = new Date(year, 0, 1, 0, 0, 0, 0);
          const end = new Date(year, 11, 31, 23, 59, 59, 999);
          buckets.push({ name: String(year), income: 0 });
          ranges.push({ start: start.getTime(), end: end.getTime() });
        }
      }

      const attributionDate = (b: { paid_at?: string | null; confirmed_at?: string | null; created_at: string }) => {
        const pick = (v?: string | null) => {
          if (!v) return null;
          const t = new Date(v).getTime();
          return Number.isFinite(t) ? t : null;
        };
        const t = pick(b.paid_at) ?? pick(b.confirmed_at) ?? new Date(b.created_at).getTime();
        return t;
      };

      let attributed = 0;
      let dropped = 0;
      paidRows.forEach(b => {
        const t = attributionDate(b);
        let placed = false;
        for (let i = 0; i < ranges.length; i++) {
          if (t >= ranges[i].start && t <= ranges[i].end) {
            buckets[i].income += fromCents(b.amount_cents);
            placed = true;
            break;
          }
        }
        if (placed) attributed++; else dropped++;
      });

      if (import.meta.env.DEV) {
        console.log('[Dashboard revenue]', {
          period,
          windowStart: windowIso,
          paidRows: paidRows.length,
          attributed,
          outsideWindow: dropped,
          buckets,
        });
      }

      setRevenueHistory(buckets);

      setMetrics({
        income: buckets.reduce((sum, b) => sum + b.income, 0),
        units: unitsCount || 0,
        users: usersCount || 0,
        requests: requestsCount || 0,
      });

      const statusRows: Array<{ name: string; match: (s: string) => boolean; color: string }> = [
        { name: 'Pending',     match: s => s === 'pending',     color: 'var(--brand-gold)' },
        { name: 'Confirmed',   match: s => s === 'confirmed',   color: 'var(--emerald-500)' },
        { name: 'In Progress', match: s => s === 'in progress', color: 'var(--indigo-500)' },
        { name: 'Completed',   match: s => s === 'completed',   color: 'var(--slate-400)' },
        { name: 'Cancelled',   match: s => s === 'cancelled',   color: 'var(--rose-500)' },
      ];
      const breakdown = statusRows.map(row => ({
        name: row.name,
        value: (volData || []).filter(v => row.match((v.status || '').toLowerCase())).length,
        color: row.color,
      }));
      setStatusBreakdown(breakdown);

      const inboxRaw: InboxItem[] = [
        { id: 'pending-res',  label: 'Bookings awaiting approval',      count: pendingReservationsCount || 0, icon: Calendar,       tone: 'gold',    navTo: 'reservations',  cta: 'Review' },
        { id: 'pending-pay',  label: 'Payments awaiting confirmation',  count: pendingConfirmationCount || 0, icon: Wallet,         tone: 'sky',     navTo: 'billing',       cta: 'Verify' },
        { id: 'refunds',      label: 'Refund requests pending',         count: refundPendingCount || 0,       icon: RotateCcw,      tone: 'rose',    navTo: 'cancellations', cta: 'Process' },
        { id: 'overdue',      label: 'Overdue invoices',                count: overdueCount || 0,             icon: AlertTriangle,  tone: 'rose',    navTo: 'billing',       cta: 'Follow up' },
        { id: 'tickets',      label: 'Open support tickets',            count: openTicketCount || 0,          icon: MessageSquare,  tone: 'indigo',  navTo: 'support',       cta: 'Respond' },
      ];
      setInbox(inboxRaw.filter(i => i.count > 0));
    } catch (err: any) {
      console.error('Fetch error:', err);
      toast.error(`Failed to sync analytics: ${err?.message || 'unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const dashboardStats = [
    { label: `Revenue (${period})`, value: metrics.income, icon: TrendingUp, bg: 'var(--brand-gold-light)', color: 'var(--brand-gold)', sub: 'Collected in selected window' },
    { label: 'Units Available',     value: metrics.units,  icon: Car,        bg: 'var(--indigo-50)',        color: 'var(--indigo-500)',  sub: 'Ready to dispatch' },
    { label: 'Total Customers',     value: metrics.users,  icon: Users,      bg: 'var(--emerald-50)',       color: 'var(--emerald-500)', sub: 'Registered accounts' },
    { label: 'Pending Bookings',    value: metrics.requests, icon: Calendar, bg: 'var(--orange-50)',        color: 'var(--orange-500)',  sub: 'Needs your approval' },
  ];

  const toneToStyle = (tone: InboxItem['tone']) => {
    switch (tone) {
      case 'gold':    return { bg: 'var(--brand-gold-light)', color: 'var(--brand-gold)'   };
      case 'sky':     return { bg: 'var(--sky-50)',           color: 'var(--sky-500)'      };
      case 'indigo':  return { bg: 'var(--indigo-50)',        color: 'var(--indigo-500)'   };
      case 'emerald': return { bg: 'var(--emerald-50)',       color: 'var(--emerald-500)'  };
      case 'rose':    return { bg: 'var(--rose-50)',          color: 'var(--rose-500)'     };
    }
  };

  return (
    <div className="space-y-8">
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p>What needs your attention today, and how the business is trending.</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-outline btn-sm" onClick={fetchDashboardData} disabled={loading}>
            {loading ? 'Syncing...' : 'Refresh Data'}
          </button>
          <button className="btn btn-brand btn-sm" onClick={() => onNavigate('reservations')}>Add Booking</button>
        </div>
      </div>

      {/* Attention Inbox */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="flex-between" style={{ padding: '20px 24px', borderBottom: '1px solid var(--slate-100)' }}>
          <div className="flex-start gap-2">
            <Inbox size={18} style={{ color: 'var(--brand-gold)' }} />
            <h2 className="section-title" style={{ margin: 0 }}>Attention Inbox</h2>
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--slate-400)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            {inbox.length === 0 ? 'All clear' : `${inbox.reduce((s, i) => s + i.count, 0)} open items`}
          </span>
        </div>
        {inbox.length === 0 ? (
          <div style={{ padding: '36px 24px', textAlign: 'center', color: 'var(--slate-400)' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--slate-500)' }}>Inbox zero — nothing waiting on you.</div>
            <p style={{ fontSize: 12, marginTop: 4 }}>New approvals, payments, refunds, or support tickets will show up here.</p>
          </div>
        ) : (
          <div>
            {inbox.map((item, idx) => {
              const t = toneToStyle(item.tone);
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.navTo)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                    width: '100%',
                    padding: '16px 24px',
                    background: 'transparent',
                    border: 'none',
                    borderBottom: idx === inbox.length - 1 ? 'none' : '1px solid var(--slate-100)',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--slate-50)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: t.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon size={18} style={{ color: t.color }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--slate-900)' }}>{item.label}</div>
                    <div style={{ fontSize: 12, color: 'var(--slate-500)' }}>{item.count} {item.count === 1 ? 'item' : 'items'} waiting</div>
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: t.color, minWidth: 36, textAlign: 'right' }}>{item.count}</div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--slate-600)', marginLeft: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                    {item.cta} <ChevronRight size={14} />
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="stat-grid dashboard-stats-row">
        {dashboardStats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <div className="stat-card" key={stat.label} style={{ animationDelay: `${i * 80}ms` }}>
              <div className="stat-top">
                <div className="stat-icon-wrap" style={{ background: stat.bg }}>
                  <Icon size={20} style={{ color: stat.color }} />
                </div>
                {stat.value > 0 && (
                  <span className="stat-change positive">
                    <ArrowUpRight size={12} />
                    Live
                  </span>
                )}
              </div>
              <div className="stat-content">
                <p className="stat-label">{stat.label}</p>
                <h3 className="stat-value">
                  {stat.label.toLowerCase().includes('revenue') ? formatPHP(stat.value) : stat.value.toLocaleString()}
                </h3>
                {stat.sub && <p className="stat-sub">{stat.sub}</p>}
              </div>
            </div>
          );
        })}
      </div>

      <div className="admin-dashboard-split">
        <div className="space-y-4">
          <div className="flex-between" style={{ height: 40, padding: '0 4px' }}>
            <h2 className="section-title" style={{ margin: 0 }}>
              <BarChart3 size={20} style={{ color: 'var(--brand-gold)' }} />
              Revenue Performance
            </h2>
            <div className="filter-tabs">
              {(['weekly', 'monthly', 'yearly'] as const).map(p => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={cn('filter-tab', period === p && 'active')}
                  style={{ textTransform: 'capitalize', fontSize: 11 }}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="card" style={{ height: 420, padding: '32px 24px 20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {revenueHistory.some(d => d.income > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueHistory} margin={{ top: 24, left: -10, right: 10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="barIncome" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--brand-gold)" stopOpacity={1} />
                      <stop offset="100%" stopColor="var(--brand-gold)" stopOpacity={0.55} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--slate-100)" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 600, fill: 'var(--slate-400)' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 600, fill: 'var(--slate-400)' }} tickFormatter={(val) => `₱${val >= 1000 ? (val/1000).toFixed(1) + 'k' : val}`} />
                  <Tooltip
                    cursor={{ fill: 'rgba(234,179,8,0.08)' }}
                    contentStyle={{ borderRadius: 'var(--radius-md)', border: 'none', boxShadow: 'var(--shadow-lg)', padding: '12px 16px' }}
                    itemStyle={{ fontWeight: 700, fontSize: 13 }}
                    formatter={(value: any) => [formatPHP(value), 'Collected']}
                  />
                  <Bar
                    dataKey="income"
                    fill="url(#barIncome)"
                    radius={[8, 8, 0, 0]}
                    maxBarSize={56}
                    animationDuration={700}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--slate-300)' }}>
                <TrendingUp size={48} style={{ margin: '0 auto 16px', opacity: 0.1 }} />
                <p style={{ fontWeight: 600, fontSize: 13 }}>No paid invoices in this period</p>
                <p style={{ fontSize: 11 }}>Revenue is measured from payments marked <strong>Paid</strong>.</p>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex-between" style={{ height: 40, padding: '0 4px' }}>
            <h2 className="section-title" style={{ margin: 0 }}>
              <Activity size={20} style={{ color: 'var(--indigo-500)' }} />
              Booking Pipeline
            </h2>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--slate-400)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {period}
            </span>
          </div>

          <div className="card-flat" style={{ height: 420, display: 'flex', flexDirection: 'column', padding: '28px 28px 24px' }}>
            {(() => {
              const totalBookings = statusBreakdown.reduce((s, r) => s + r.value, 0);
              if (totalBookings === 0) {
                return (
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: 'var(--slate-300)' }}>
                    <div>
                      <BarChart3 size={48} style={{ margin: '0 auto 16px', opacity: 0.1 }} />
                      <p style={{ fontWeight: 600, fontSize: 13 }}>No bookings in this period</p>
                      <p style={{ fontSize: 11 }}>New reservations will appear here as they come in.</p>
                    </div>
                  </div>
                );
              }
              const completionRate = Math.round(
                ((statusBreakdown.find(s => s.name === 'Completed')?.value || 0) / totalBookings) * 100
              );
              return (
                <>
                  <div className="flex-between" style={{ marginBottom: 20 }}>
                    <div>
                      <p style={{ fontSize: 11, fontWeight: 800, color: 'var(--slate-400)', letterSpacing: '0.1em' }}>TOTAL BOOKINGS</p>
                      <h3 style={{ fontSize: 28, fontWeight: 800, marginTop: 4 }}>{totalBookings}</h3>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: 11, fontWeight: 800, color: 'var(--slate-400)', letterSpacing: '0.1em' }}>COMPLETION</p>
                      <h3 style={{ fontSize: 20, fontWeight: 800, marginTop: 4, color: 'var(--emerald-600)' }}>{completionRate}%</h3>
                    </div>
                  </div>

                  <div style={{ flex: 1, minHeight: 0 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={statusBreakdown} layout="vertical" margin={{ top: 4, left: -10, right: 24, bottom: 4 }}>
                        <XAxis type="number" hide />
                        <YAxis
                          dataKey="name"
                          type="category"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 12, fontWeight: 700, fill: 'var(--slate-600)' }}
                          width={100}
                        />
                        <Tooltip
                          cursor={{ fill: 'transparent' }}
                          contentStyle={{ borderRadius: 'var(--radius-md)', border: 'none', boxShadow: 'var(--shadow-lg)', padding: '10px 14px' }}
                          formatter={(v: any, _n, p: any) => [`${v} (${Math.round((v / totalBookings) * 100)}%)`, p?.payload?.name || 'Bookings']}
                        />
                        <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={22}>
                          {statusBreakdown.map((entry, i) => (
                            <Cell key={`cell-${i}`} fill={entry.color} />
                          ))}
                          <LabelList dataKey="value" position="right" style={{ fontSize: 12, fontWeight: 700, fill: 'var(--slate-600)' }} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}
