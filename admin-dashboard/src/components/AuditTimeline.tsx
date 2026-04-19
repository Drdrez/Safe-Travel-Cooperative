import { useEffect, useState } from 'react';
import { Loader2, Circle, History } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatDateTime } from '@/lib/date';

type AuditEntry = {
  id: number;
  actor_id: string | null;
  action: string;
  target: string | null;
  details: Record<string, any> | null;
  created_at: string;
};

type ActorMap = Record<string, { full_name: string | null; email: string | null }>;

const ACTION_LABELS: Record<string, string> = {
  'reservation.created': 'Reservation created',
  'reservation.status_changed': 'Status changed',
  'reservation.vehicle_changed': 'Vehicle reassigned',
  'reservation.driver_changed': 'Driver reassigned',
  'billing.created': 'Invoice created',
  'billing.status_changed': 'Invoice status changed',
  'billing.refund_status_changed': 'Refund status changed',
};

function describe(e: AuditEntry): string {
  const d = e.details || {};
  switch (e.action) {
    case 'reservation.status_changed':     return `${d.from ?? '—'} → ${d.to ?? '—'}`;
    case 'reservation.vehicle_changed':    return 'Vehicle assignment updated';
    case 'reservation.driver_changed':     return 'Driver assignment updated';
    case 'billing.status_changed':         return `Invoice ${d.from ?? ''} → ${d.to ?? ''}`;
    case 'billing.refund_status_changed':  return `Refund ${d.from ?? '—'} → ${d.to ?? '—'}`;
    case 'billing.created':                return `Invoice opened (${d.status ?? 'Pending'})`;
    case 'reservation.created':            return `Booked (${d.status ?? 'Pending'})`;
    default:                               return e.action;
  }
}

interface Props {
  reservationId: string;
}

export function AuditTimeline({ reservationId }: Props) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [actors, setActors] = useState<ActorMap>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('audit_log')
        .select('id, actor_id, action, target, details, created_at')
        .eq('target', `reservation:${reservationId}`)
        .order('created_at', { ascending: false })
        .limit(50);
      if (!active) return;
      if (error || !data) { setLoading(false); return; }
      setEntries(data as AuditEntry[]);

      // Batch-fetch actor profiles (admins who performed the action).
      const actorIds = Array.from(new Set(
        (data as AuditEntry[]).map(e => e.actor_id).filter((x): x is string => !!x)
      ));
      if (actorIds.length > 0) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', actorIds);
        if (active && profs) {
          const map: ActorMap = {};
          for (const p of profs as any[]) {
            map[p.id] = { full_name: p.full_name ?? null, email: p.email ?? null };
          }
          setActors(map);
        }
      }
      setLoading(false);
    })();
    return () => { active = false; };
  }, [reservationId]);

  return (
    <div>
      <div className="flex-start" style={{ gap: 8, marginBottom: 12 }}>
        <History size={16} style={{ color: 'var(--slate-500)' }} />
        <h4 style={{ fontSize: 13, fontWeight: 800, color: 'var(--slate-700)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Activity history</h4>
      </div>

      {loading ? (
        <div style={{ padding: 20, display: 'flex', justifyContent: 'center', color: 'var(--slate-400)' }}>
          <Loader2 size={18} className="animate-spin" />
        </div>
      ) : entries.length === 0 ? (
        <p style={{ fontSize: 12, color: 'var(--slate-400)', padding: '12px 0' }}>
          No activity yet. Actions will appear here once the booking moves through the workflow.
        </p>
      ) : (
        <ol style={{ listStyle: 'none', padding: 0, margin: 0, borderLeft: '2px solid var(--slate-100)' }}>
          {entries.map(e => {
            const actor = (e.actor_id && actors[e.actor_id]?.full_name) || (e.actor_id ? 'User' : 'System');
            return (
              <li key={e.id} style={{ position: 'relative', padding: '10px 0 10px 20px' }}>
                <Circle size={10} style={{ position: 'absolute', left: -6, top: 14, color: 'var(--brand-gold)', fill: 'var(--brand-gold)' }} />
                <div className="flex-between" style={{ gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--slate-900)' }}>
                    {ACTION_LABELS[e.action] || e.action}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--slate-400)' }}>{formatDateTime(e.created_at)}</span>
                </div>
                <p style={{ fontSize: 12, color: 'var(--slate-600)', marginTop: 2 }}>{describe(e)}</p>
                <p style={{ fontSize: 11, color: 'var(--slate-400)', marginTop: 2 }}>by {actor}</p>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
