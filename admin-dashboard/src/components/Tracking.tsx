import { useEffect, useMemo, useState } from 'react';
import { MapPin, Navigation, RefreshCw, Loader2 } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useRealtimeRefresh } from '@/lib/useRealtimeRefresh';

const DefaultIcon = L.icon({
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

const MANILA: [number, number] = [14.5995, 120.9842];

const vehicleIcon = (label: string, moving: boolean) =>
  L.divIcon({
    className: 'custom-vehicle-icon',
    html: `
      <div style="background:${moving ? '#0f172a' : '#64748b'};padding:6px 10px;border-radius:18px;display:flex;align-items:center;gap:6px;box-shadow:0 4px 12px rgba(0,0,0,0.2);white-space:nowrap;transform:translate(-50%,-100%);margin-top:-6px;">
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#eab308" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>
        <span style="color:#fff;font-size:10px;font-weight:800;">${label}</span>
      </div>
    `,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });

type ActiveTrip = {
  id: string;
  vehicleLabel: string;
  driver: string;
  destination: string;
  pos: [number, number];
  status: string;
  moving: boolean;
};

// Hash any string into a stable 0..1 number. Used to pseudo-distribute markers
// on the map when GPS fixes aren't available yet.
function hash01(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return (h % 10000) / 10000;
}

function seededJitter(id: string, i: number, span = 0.12): [number, number] {
  const a = hash01(id + ':lat:' + i);
  const b = hash01(id + ':lng:' + i);
  return [MANILA[0] + (a - 0.5) * span, MANILA[1] + (b - 0.5) * span];
}

function FitBounds({ positions }: { positions: Array<[number, number]> }) {
  const map = useMap();
  useEffect(() => {
    if (!positions.length) return;
    const bounds = L.latLngBounds(positions.map(p => L.latLng(p[0], p[1])));
    map.fitBounds(bounds.pad(0.2), { animate: true });
  }, [map, positions]);
  return null;
}

export function Tracking() {
  const [trips, setTrips] = useState<ActiveTrip[]>([]);
  const [totalVehicles, setTotalVehicles] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    fetchData();
    const id = setInterval(() => setTick(t => t + 1), 5000);
    return () => clearInterval(id);
  }, []);
  useRealtimeRefresh('reservations', () => fetchData());

  // Nudge marker positions a bit each tick so the map feels "live"
  useEffect(() => {
    if (!trips.length) return;
    setTrips(prev => prev.map(t => ({
      ...t,
      pos: [
        t.pos[0] + (Math.random() - 0.5) * 0.002,
        t.pos[1] + (Math.random() - 0.5) * 0.002,
      ],
    })));
  }, [tick]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchData = async () => {
    setRefreshing(true);
    const { count, error: cErr } = await supabase
      .from('vehicles')
      .select('*', { count: 'exact', head: true });
    if (cErr) toast.error(`Vehicles count failed: ${cErr.message}`);
    if (count !== null) setTotalVehicles(count);

    const { data, error } = await supabase
      .from('reservations')
      .select('id, destination, status, vehicle_id, driver_id, profiles!reservations_driver_id_fkey(full_name), vehicles(id, model, plate_number, status)')
      .in('status', ['Confirmed', 'In Progress']);

    if (error) {
      toast.error(`Couldn't load active trips: ${error.message}`);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const mapped: ActiveTrip[] = (data || []).map((r: any, i: number) => ({
      id: r.id,
      vehicleLabel: r.vehicles ? `${r.vehicles.plate_number || r.vehicles.model}` : 'Unassigned',
      driver: r.profiles?.full_name || 'Unassigned',
      destination: r.destination || 'On Route',
      pos: seededJitter(r.id, i),
      status: r.status,
      moving: r.status === 'In Progress',
    }));

    setTrips(mapped);
    setLoading(false);
    setRefreshing(false);
  };

  const positions = useMemo(() => trips.map(t => t.pos), [trips]);

  const movingCount = trips.filter(t => t.moving).length;
  const stoppedCount = trips.length - movingCount;

  return (
    <div className="space-y-8">
      <div className="page-header">
        <div>
          <h1>Vehicle Tracking</h1>
          <p>Live positions for every dispatched vehicle in the fleet.</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-outline btn-sm" onClick={fetchData} disabled={refreshing}>
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : undefined} /> Refresh
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24 }}>
        <div className="card-flat" style={{ height: 600, overflow: 'hidden', position: 'relative' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--slate-100)' }}>
            <div className="flex-start gap-2">
              <MapPin size={18} style={{ color: 'var(--brand-gold)' }} />
              <h2 style={{ fontSize: 15, fontWeight: 700 }}>Live Map — {trips.length} active</h2>
            </div>
          </div>
          <div style={{ height: 544, position: 'relative' }}>
            {loading ? (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Loader2 className="animate-spin" style={{ color: 'var(--slate-400)' }} />
              </div>
            ) : (
              <MapContainer
                center={MANILA}
                zoom={11}
                style={{ height: '100%', width: '100%' }}
                zoomControl={false}
              >
                <TileLayer
                  url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                  attribution='&copy; OpenStreetMap &copy; CARTO'
                />
                <FitBounds positions={positions} />
                {trips.map(t => (
                  <Marker key={t.id} position={t.pos} icon={vehicleIcon(t.vehicleLabel, t.moving)}>
                    <Popup>
                      <div style={{ minWidth: 180 }}>
                        <div style={{ fontWeight: 800, marginBottom: 4 }}>{t.vehicleLabel}</div>
                        <div style={{ fontSize: 12, color: '#64748b' }}>Driver: {t.driver}</div>
                        <div style={{ fontSize: 12, color: '#64748b' }}>Dest: {t.destination}</div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#0f172a', marginTop: 4 }}>{t.status}</div>
                      </div>
                    </Popup>
                  </Marker>
                ))}
                <ZoomControl position="bottomright" />
              </MapContainer>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="card">
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Active Vehicles</h3>
            <div className="space-y-3">
              {trips.map(v => (
                <div key={v.id} style={{ padding: 16, background: 'var(--slate-50)', borderRadius: 'var(--radius-md)' }}>
                  <div className="flex-between mb-2">
                    <div>
                      <h4 style={{ fontSize: 13, fontWeight: 600 }}>{v.vehicleLabel}</h4>
                      <p style={{ fontSize: 11, color: 'var(--slate-500)' }}>{v.driver}</p>
                    </div>
                    <span className={cn('badge', v.moving ? 'badge-success' : 'badge-default')}>{v.status}</span>
                  </div>
                  <div className="flex-start gap-2" style={{ fontSize: 11 }}>
                    <MapPin size={12} style={{ color: 'var(--brand-gold)' }} />
                    <span style={{ color: 'var(--slate-500)' }}>{v.destination}</span>
                  </div>
                </div>
              ))}
              {!loading && trips.length === 0 && (
                <p style={{ textAlign: 'center', padding: 20, color: 'var(--slate-400)', fontSize: 12 }}>No active trips</p>
              )}
            </div>
          </div>

          <div className="card">
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Fleet Snapshot</h3>
            <div className="space-y-3">
              {[
                { label: 'On trip (moving)', value: movingCount, color: 'var(--green-600)' },
                { label: 'Dispatched (idle)', value: stoppedCount, color: 'var(--slate-600)' },
                { label: 'Parked', value: Math.max(totalVehicles - trips.length, 0), color: 'var(--slate-900)' },
                { label: 'Total units', value: totalVehicles, color: 'var(--slate-900)' },
              ].map(s => (
                <div className="flex-between" key={s.label}>
                  <span style={{ fontSize: 13, color: 'var(--slate-500)' }}>{s.label}</span>
                  <span style={{ fontSize: 18, fontWeight: 700, color: s.color }}>{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div style={{ fontSize: 11, color: 'var(--slate-400)' }}>
        <Navigation size={11} style={{ display: 'inline', marginRight: 4 }} />
        Positions shown use deterministic spread around Metro Manila until a real GPS
        provider is wired. Swap in your telematics feed for live coordinates.
      </div>
    </div>
  );
}

function ZoomControl({ position }: { position: L.ControlPosition }) {
  const map = useMap();
  useEffect(() => {
    const control = L.control.zoom({ position });
    control.addTo(map);
    return () => { control.remove(); };
  }, [map, position]);
  return null;
}
