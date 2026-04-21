import { useEffect, useRef, useState } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type Notification = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
};

const MAX_DISPLAY = 15;

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60)        return 'just now';
  if (diff < 3600)      return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)     return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}

const KIND_SCREEN: Record<string, string> = {
  'admin.reservation.new':     'reservations',
  'admin.billing.submitted':   'billing',
  'admin.billing.refund':      'billing',
  'admin.ticket.new':          'support',
  'admin.loan.new':            'loans',
  'reservation.confirmed':     'reservations',
  'reservation.in_progress':   'tracking',
  'reservation.completed':     'reservations',
  'reservation.cancelled':     'reservations',
  'billing.paid':              'billing',
  'billing.submitted':         'billing',
  'billing.overdue':           'billing',
  'loan.approved':             'loans',
  'loan.rejected':             'loans',
  'loan.disbursed':            'loans',
  'loan.closed':               'loans',
  'payroll.posted':            'payroll',
};

function resolveScreen(n: { kind: string; link: string | null }): string | null {
  if (KIND_SCREEN[n.kind]) return KIND_SCREEN[n.kind];
  const l = n.link ?? '';
  if (l.includes('/billing'))      return 'billing';
  if (l.includes('/support'))      return 'support';
  if (l.includes('/tracking'))     return 'tracking';
  if (l.includes('/reservations')) return 'reservations';
  if (l.includes('/loans'))        return 'loans';
  if (l.includes('/payroll'))      return 'payroll';
  if (l.includes('/members'))      return 'members';
  if (l.includes('/maintenance'))  return 'maintenance';
  return null;
}

interface Props {
  onNavigate?: (screen: string) => void;
}

export function NotificationBell({ onNavigate }: Props) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const btnRef   = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id;
      if (!uid || !active) return;
      setUserId(uid);
      await refresh(uid);
    })();

    const onDocClick = (e: MouseEvent) => {
      if (!panelRef.current || !btnRef.current) return;
      const t = e.target as Node;
      if (!panelRef.current.contains(t) && !btnRef.current.contains(t)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);

    return () => { active = false; document.removeEventListener('mousedown', onDocClick); };
  }, []);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`notif:${userId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        () => refresh(userId)
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  const refresh = async (uid: string) => {
    const { data, error } = await supabase
      .from('notifications')
      .select('id, kind, title, body, link, read_at, created_at')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
      .limit(MAX_DISPLAY);
    if (!error && data) setNotifications(data as Notification[]);
  };

  const unreadCount = notifications.filter(n => !n.read_at).length;

  const markAllRead = async () => {
    if (!userId || unreadCount === 0) return;
    const now = new Date().toISOString();
    const unreadIds = notifications.filter(n => !n.read_at).map(n => n.id);
    setNotifications(prev => prev.map(n => n.read_at ? n : { ...n, read_at: now }));
    await supabase.from('notifications').update({ read_at: now }).in('id', unreadIds);
  };

  const handleClick = async (n: Notification) => {
    if (!n.read_at) {
      const now = new Date().toISOString();
      setNotifications(prev => prev.map(p => p.id === n.id ? { ...p, read_at: now } : p));
      await supabase.from('notifications').update({ read_at: now }).eq('id', n.id);
    }
    setOpen(false);
    const screen = resolveScreen(n);
    if (screen && onNavigate) {
      onNavigate(screen);
    } else if (import.meta.env.DEV) {
      console.warn('[notifications] no screen for kind/link:', n.kind, n.link);
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      <button
        ref={btnRef}
        onClick={() => setOpen(v => !v)}
        className="btn btn-outline btn-sm"
        style={{ padding: '8px 12px', borderRadius: 'var(--radius-md)', position: 'relative' }}
        aria-label="Notifications"
      >
        <Bell size={16} />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: 2, right: 2,
            background: 'var(--rose-500, #ef4444)', color: 'white',
            fontSize: 10, fontWeight: 800, borderRadius: 999,
            minWidth: 18, height: 18, padding: '0 5px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 0 2px white',
          }}>{unreadCount > 9 ? '9+' : unreadCount}</span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          style={{
            position: 'absolute', top: 'calc(100% + 8px)', right: 0,
            width: 360, maxHeight: 480, overflow: 'hidden',
            background: 'white', borderRadius: 14,
            boxShadow: '0 20px 50px rgba(15,23,42,0.18)',
            border: '1px solid var(--slate-100)', zIndex: 50,
            display: 'flex', flexDirection: 'column',
          }}
        >
          <div className="flex-between" style={{ padding: '14px 16px', borderBottom: '1px solid var(--slate-100)' }}>
            <span style={{ fontWeight: 800, fontSize: 14 }}>Notifications</span>
            <button
              onClick={markAllRead}
              disabled={unreadCount === 0}
              style={{ fontSize: 12, fontWeight: 700, color: unreadCount ? 'var(--brand-gold-dark)' : 'var(--slate-300)', display: 'inline-flex', alignItems: 'center', gap: 4, background: 'transparent', border: 'none', cursor: unreadCount ? 'pointer' : 'default' }}
            >
              <CheckCheck size={14} /> Mark all read
            </button>
          </div>

          <div style={{ overflowY: 'auto', flex: 1 }}>
            {notifications.length === 0 ? (
              <div style={{ padding: 36, textAlign: 'center', color: 'var(--slate-400)', fontSize: 13 }}>
                You're all caught up.
              </div>
            ) : notifications.map(n => (
              <button
                key={n.id}
                onClick={() => handleClick(n)}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: '14px 16px', border: 'none',
                  borderBottom: '1px solid var(--slate-100)',
                  background: n.read_at ? 'white' : 'rgba(234,179,8,0.06)',
                  cursor: 'pointer',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--slate-50)'}
                onMouseLeave={e => e.currentTarget.style.background = n.read_at ? 'white' : 'rgba(234,179,8,0.06)'}
              >
                <div className="flex-between" style={{ marginBottom: 2 }}>
                  <span style={{ fontWeight: 800, fontSize: 13, color: 'var(--slate-900)' }}>{n.title}</span>
                  <span style={{ fontSize: 11, color: 'var(--slate-400)' }}>{timeAgo(n.created_at)}</span>
                </div>
                {n.body && <p style={{ fontSize: 12, color: 'var(--slate-500)', lineHeight: 1.45 }}>{n.body}</p>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
