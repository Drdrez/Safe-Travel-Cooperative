import { useEffect, useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useRealtimeRefresh } from '@/lib/useRealtimeRefresh';

const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function Dispatch() {
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [dispatchList, setDispatchList] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedDayRes, setSelectedDayRes] = useState<any[]>([]);

  useEffect(() => { fetchDispatches(); }, [currentDate]);
  useRealtimeRefresh('reservations', () => fetchDispatches());

  const fetchDispatches = async () => {
    const { data, error } = await supabase.from('reservations')
      .select('id, reservation_id_str, pickup_location, destination, status, start_date, profiles!reservations_driver_id_fkey(full_name), vehicles(model, plate_number)')
      .in('status', ['Pending', 'Confirmed', 'In Progress'])
      .order('start_date', { ascending: true });

    if (error) toast.error(`Couldn't load schedule: ${error.message}`);
    if (data) {
      const formatted = data.map(d => ({
        id: d.id,
        ref: d.reservation_id_str,
        driver: (d.profiles as any)?.full_name || 'Unassigned',
        vehicle: d.vehicles ? `${(d.vehicles as any).model} - ${(d.vehicles as any).plate_number}` : 'N/A',
        destination: d.destination || 'N/A',
        time: d.start_date,
        status: d.status,
        dateObj: new Date(d.start_date)
      }));
      setDispatchList(formatted);
    }
  };

  useEffect(() => {
    setSelectedDayRes(dispatchList.filter(d => d.dateObj.toDateString() === selectedDate.toDateString()));
  }, [selectedDate, dispatchList]);

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear(), month = date.getMonth();
    const days: (Date | null)[] = [];
    const firstDay = new Date(year, month, 1).getDay();
    const numDays = new Date(year, month + 1, 0).getDate();
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let i = 1; i <= numDays; i++) days.push(new Date(year, month, i));
    return days;
  };

  const getDaysInWeek = (date: Date) => {
    const curr = new Date(date);
    const first = curr.getDate() - curr.getDay();
    return Array.from({ length: 7 }, (_, i) => new Date(new Date(curr).setDate(first + i)));
  };

  const navigate = (dir: number) => {
    const next = new Date(currentDate);
    if (viewMode === 'month') next.setMonth(next.getMonth() + dir);
    else next.setDate(next.getDate() + dir * 7);
    setCurrentDate(next);
  };

  const updateStatus = async (id: string, newStatus: string) => {
    const { error } = await supabase.from('reservations').update({ status: newStatus }).eq('id', id);
    if (!error) { toast.success('Status updated'); fetchDispatches(); }
    else toast.error('Update failed');
  };

  const days = viewMode === 'month' ? getDaysInMonth(currentDate) : getDaysInWeek(currentDate);

  return (
    <div className="space-y-8">
      <div className="page-header">
        <div><h1>Dispatch & Schedule</h1><p>Manage driver schedules and dispatches.</p></div>
      </div>

      <div className="card">
        <div className="flex-between mb-6">
          <h2 style={{ fontSize: 16, fontWeight: 700 }}>
            {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
          </h2>
          <div className="flex-start gap-2">
            <button className="btn btn-outline btn-sm" onClick={() => navigate(-1)}><ChevronLeft size={16} /></button>
            <button className="btn btn-outline btn-sm" onClick={() => navigate(1)}><ChevronRight size={16} /></button>
            <div className="filter-tabs" style={{ marginLeft: 8 }}>
              <button className={cn('filter-tab', viewMode === 'week' && 'active')} onClick={() => setViewMode('week')}>Week</button>
              <button className={cn('filter-tab', viewMode === 'month' && 'active')} onClick={() => setViewMode('month')}>Month</button>
            </div>
          </div>
        </div>

        <div className="calendar-grid">
          {dayNames.map(d => <div className="calendar-day-header" key={d}>{d}</div>)}
          {days.map((day, i) => {
            if (!day) return <div key={`e-${i}`} />;
            const isSelected = day.toDateString() === selectedDate.toDateString();
            const isToday = day.toDateString() === new Date().toDateString();
            const dayRes = dispatchList.filter(d => d.dateObj.toDateString() === day.toDateString());
            return (
              <div key={day.toISOString()} onClick={() => setSelectedDate(day)}
                className={cn('calendar-cell', isSelected && 'selected', isToday && 'today')}>
                <div className="calendar-date" style={{ color: isToday ? 'var(--sky-500)' : undefined }}>{day.getDate()}</div>
                {dayRes.slice(0, 2).map(r => <div className="calendar-event" key={r.id}>{r.driver.split(' ')[0]} - {r.status}</div>)}
                {dayRes.length > 2 && <div style={{ fontSize: 9, color: 'var(--slate-400)', textAlign: 'center' }}>+{dayRes.length - 2} more</div>}
              </div>
            );
          })}
        </div>
      </div>

      <div className="card">
        <div className="flex-start gap-2 mb-6">
          <Calendar size={16} style={{ color: 'var(--brand-gold)' }} />
          <span style={{ fontSize: 13, color: 'var(--slate-500)' }}>
            {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </span>
        </div>

        {selectedDayRes.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><Calendar size={28} /></div>
            <p>No dispatches scheduled for this day</p>
          </div>
        ) : (
          <div className="space-y-3">
            {selectedDayRes.map((d) => (
              <div key={d.id} style={{ padding: 16, background: 'var(--slate-50)', borderRadius: 'var(--radius-md)' }}>
                <div className="flex-between" style={{ flexWrap: 'wrap', gap: 16 }}>
                  <div className="flex-start gap-3">
                    <div className="avatar">{d.driver.split(' ').map((n: string) => n[0]).join('').substring(0, 2)}</div>
                    <div>
                      <h4 style={{ fontWeight: 700, fontSize: 14 }}>{d.driver}</h4>
                      <p style={{ fontSize: 12, color: 'var(--slate-500)' }}>{d.vehicle} • {d.ref}</p>
                    </div>
                  </div>
                  <div className="flex-start gap-4" style={{ flexWrap: 'wrap' }}>
                    <div><p style={{ fontSize: 11, color: 'var(--slate-400)' }}>Destination</p><p style={{ fontSize: 13, fontWeight: 500 }}>{d.destination}</p></div>
                    <div><p style={{ fontSize: 11, color: 'var(--slate-400)' }}>Time</p><p style={{ fontSize: 13, fontWeight: 500 }}>{new Date(d.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p></div>
                    <span className={cn(
                      'badge',
                      d.status === 'In Progress' ? 'badge-info' :
                      d.status === 'Confirmed'   ? 'badge-success' :
                                                   'badge-warning'
                    )}>{d.status}</span>
                    {d.status !== 'Completed' && (
                      <select className="form-select" style={{ width: 140, height: 32, fontSize: 12 }}
                        value={d.status} onChange={e => updateStatus(d.id, e.target.value)}>
                        <option value="Pending">Pending</option>
                        <option value="Confirmed">Confirmed</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Completed">Completed</option>
                      </select>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
