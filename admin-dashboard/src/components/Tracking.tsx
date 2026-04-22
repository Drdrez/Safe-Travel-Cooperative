import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { MapPin, Navigation, RefreshCw, Loader2, Play, Pause, RotateCcw } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useRealtimeRefresh } from '@/lib/useRealtimeRefresh';
import { getMapTileLayerConfig } from '@/lib/mapTiles';
import { fetchDrivingRoute } from '@/lib/drivingDirections';
import { positionAlongPolyline, type LatLng } from '@/lib/routeGeometry';
import { DAVAO_DEMO_STOPS } from '@/lib/davaoDemoRoute';
import { GoogleAdminTrackingMap } from '@/components/GoogleAdminTrackingMap';

const GOOGLE_MAPS_KEY = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined)?.trim() ?? '';

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

function numberedStopIcon(index: number, isEnd: boolean) {
  const inner = isEnd
    ? `<span style="position:absolute;left:50%;top:9px;transform:translate(-50%,-50%);width:7px;height:7px;border-radius:50%;background:#fff;border:2px solid #dc2626"></span>`
    : `<span style="position:absolute;left:50%;top:11px;transform:translate(-50%,-50%);font-size:11px;font-weight:800;color:#fff">${index + 1}</span>`;
  return L.divIcon({
    className: 'custom-route-stop-icon',
    html: `
      <div style="position:relative;width:28px;height:36px;transform:translate(-50%,-100%);filter:drop-shadow(0 2px 4px rgba(0,0,0,.2))">
        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 24 30" fill="none">
          <path d="M12 0C7.03 0 3 3.94 3 8.8c0 5.86 9 15.2 9 15.2s9-9.34 9-15.2C21 3.94 16.97 0 12 0z" fill="#dc2626"/>
        </svg>
        ${inner}
      </div>
    `,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

const demoVehicleIcon = L.divIcon({
  className: 'demo-vehicle-icon',
  html: `
    <div style="background:#1e3a8a;padding:8px 12px;border-radius:20px;display:flex;align-items:center;gap:8px;box-shadow:0 6px 16px rgba(0,0,0,0.25);white-space:nowrap;transform:translate(-50%,-100%);margin-top:-8px;border:2px solid #fff">
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#93c5fd" stroke-width="2"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>
      <span style="color:#fff;font-size:10px;font-weight:800;">Demo unit</span>
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
    map.fitBounds(bounds.pad(0.15), { animate: true, maxZoom: 13 });
  }, [map, positions]);
  return null;
}

export function Tracking() {
  const [trips, setTrips] = useState<ActiveTrip[]>([]);
  const [totalVehicles, setTotalVehicles] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tick, setTick] = useState(0);

  const mapTiles = useMemo(() => getMapTileLayerConfig(), []);
  const straightDemo = useMemo(() => DAVAO_DEMO_STOPS.map(s => s.coords), []);
  const stopIcons = useMemo(
    () => DAVAO_DEMO_STOPS.map((_, i) => numberedStopIcon(i, i === DAVAO_DEMO_STOPS.length - 1)),
    [],
  );

  const [demoMode, setDemoMode] = useState(false);
  const [demoPolyline, setDemoPolyline] = useState<LatLng[]>(straightDemo);
  const [demoRouteLoading, setDemoRouteLoading] = useState(false);
  const [demoPlaying, setDemoPlaying] = useState(false);
  const [demoProgress, setDemoProgress] = useState(0);
  const [demoRouteReloadNonce, setDemoRouteReloadNonce] = useState(0);

  const onDemoPolyline = useCallback((path: LatLng[]) => setDemoPolyline(path), []);
  const onDemoRouteLoading = useCallback((v: boolean) => setDemoRouteLoading(v), []);

  const demoCenter = useMemo((): LatLng => {
    const pts = demoPolyline;
    const lats = pts.map(c => c[0]);
    const lngs = pts.map(c => c[1]);
    return [(Math.min(...lats) + Math.max(...lats)) / 2, (Math.min(...lngs) + Math.max(...lngs)) / 2];
  }, [demoPolyline]);

  const demoVehiclePos = useMemo(
    () => positionAlongPolyline(demoPolyline, demoProgress / 100),
    [demoPolyline, demoProgress],
  );

  const loadDemoRouteOsrm = useCallback(async () => {
    setDemoRouteLoading(true);
    try {
      const { coordinates, source } = await fetchDrivingRoute(straightDemo);
      setDemoPolyline(coordinates);
      toast.success(`Demo route loaded (${source === 'mapbox' ? 'Mapbox' : 'OSRM'} roads)`);
    } catch (e) {
      console.warn(e);
      setDemoPolyline(straightDemo);
      toast.error('Could not load road geometry; using straight segments.');
    } finally {
      setDemoRouteLoading(false);
    }
  }, [straightDemo]);

  useEffect(() => {
    if (!demoMode) return;
    if (GOOGLE_MAPS_KEY) return;
    loadDemoRouteOsrm();
  }, [demoMode, GOOGLE_MAPS_KEY, loadDemoRouteOsrm]);

  const reloadDemoRoute = useCallback(() => {
    if (GOOGLE_MAPS_KEY) {
      setDemoRouteReloadNonce((n) => n + 1);
    } else {
      loadDemoRouteOsrm();
    }
  }, [GOOGLE_MAPS_KEY, loadDemoRouteOsrm]);

  useEffect(() => {
    if (!demoPlaying) return;
    const id = window.setInterval(() => {
      setDemoProgress(p => {
        if (p >= 100) return 100;
        return p + 1;
      });
    }, 120);
    return () => window.clearInterval(id);
  }, [demoPlaying]);

  useEffect(() => {
    if (demoProgress >= 100) setDemoPlaying(false);
  }, [demoProgress]);

  const exitDemo = () => {
    setDemoMode(false);
    setDemoPlaying(false);
    setDemoProgress(0);
    setDemoPolyline(straightDemo);
  };

  useEffect(() => {
    fetchData();
    const id = setInterval(() => setTick(t => t + 1), 5000);
    return () => clearInterval(id);
  }, []);
  useRealtimeRefresh('reservations', () => fetchData());

  useEffect(() => {
    if (!trips.length || demoMode) return;
    setTrips(prev => prev.map(t => ({
      ...t,
      pos: [
        t.pos[0] + (Math.random() - 0.5) * 0.002,
        t.pos[1] + (Math.random() - 0.5) * 0.002,
      ],
    })));
  }, [tick, demoMode]); // eslint-disable-line react-hooks/exhaustive-deps

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
          <p>
            Live fleet map or Davao multi-stop demo.
            {GOOGLE_MAPS_KEY ? ' Using Google Maps.' : ' Add VITE_GOOGLE_MAPS_API_KEY on Vercel for Google (otherwise Leaflet).'}
          </p>
        </div>
        <div className="page-header-actions" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {demoMode ? (
            <button type="button" className="btn btn-brand btn-sm" onClick={exitDemo}>
              Exit demo · Fleet view
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => {
                setDemoMode(true);
                setDemoProgress(0);
                setDemoPlaying(false);
              }}
            >
              <Navigation size={14} /> Multi-stop demo (Davao)
            </button>
          )}
          <button className="btn btn-outline btn-sm" onClick={fetchData} disabled={refreshing}>
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : undefined} /> Refresh
          </button>
        </div>
      </div>

      <div className="admin-tracking-split">
        <div className="card-flat" style={{ minHeight: 600, overflow: 'hidden', position: 'relative' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--slate-100)' }}>
            <div className="flex-start gap-2" style={{ flexWrap: 'wrap', justifyContent: 'space-between' }}>
              <div className="flex-start gap-2">
                <MapPin size={18} style={{ color: 'var(--brand-gold)' }} />
                <h2 style={{ fontSize: 15, fontWeight: 700 }}>
                  {demoMode ? 'Demo — numbered stops & road route (Davao)' : `Live Map — ${trips.length} active`}
                </h2>
              </div>
              {demoMode && (
                <div className="flex-start gap-2" style={{ flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    disabled={demoRouteLoading}
                    onClick={() => {
                      if (demoProgress >= 100) setDemoProgress(0);
                      setDemoPlaying(true);
                    }}
                  >
                    <Play size={14} /> Play
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    disabled={!demoPlaying}
                    onClick={() => setDemoPlaying(false)}
                  >
                    <Pause size={14} /> Pause
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => {
                      setDemoProgress(0);
                      setDemoPlaying(false);
                    }}
                  >
                    <RotateCcw size={14} /> Reset
                  </button>
                  <button type="button" className="btn btn-outline btn-sm" onClick={reloadDemoRoute} disabled={demoRouteLoading}>
                    <RefreshCw size={14} className={demoRouteLoading ? 'animate-spin' : undefined} /> Reload roads
                  </button>
                </div>
              )}
            </div>
            {demoMode && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 11, color: 'var(--slate-500)', marginBottom: 6 }}>
                  Start = pin 1, vias = 2…n−1, End = last pin. Progress: {demoProgress}%
                </div>
                <div style={{ width: '100%', height: 6, background: 'var(--slate-100)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ width: `${demoProgress}%`, height: '100%', background: '#2563eb', transition: 'width 0.12s linear' }} />
                </div>
              </div>
            )}
          </div>
          <div style={{ height: 520, position: 'relative' }}>
            {loading ? (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Loader2 className="animate-spin" style={{ color: 'var(--slate-400)' }} />
              </div>
            ) : GOOGLE_MAPS_KEY ? (
              <GoogleAdminTrackingMap
                apiKey={GOOGLE_MAPS_KEY}
                demoMode={demoMode}
                trips={trips}
                demoStops={DAVAO_DEMO_STOPS}
                straightDemo={straightDemo}
                demoPolyline={demoPolyline}
                demoVehiclePos={demoVehiclePos}
                demoRouteReloadNonce={demoRouteReloadNonce}
                onDemoPolyline={onDemoPolyline}
                onDemoRouteLoading={onDemoRouteLoading}
              />
            ) : (
              <MapContainer
                center={demoMode ? demoCenter : MANILA}
                zoom={demoMode ? (mapTiles.tileSize === 512 ? 12 : 11) : 11}
                style={{ height: '100%', width: '100%' }}
                zoomControl={false}
              >
                <TileLayer
                  url={mapTiles.url}
                  attribution={mapTiles.attribution}
                  tileSize={mapTiles.tileSize ?? 256}
                  zoomOffset={mapTiles.zoomOffset ?? 0}
                  {...(mapTiles.subdomains ? { subdomains: mapTiles.subdomains } : {})}
                />
                {demoMode ? (
                  <>
                    <FitBounds positions={demoPolyline} />
                    <Polyline
                      positions={demoPolyline}
                      pathOptions={{ color: '#2563eb', weight: 6, opacity: 0.92 }}
                    />
                    {DAVAO_DEMO_STOPS.map((stop, i) => (
                      <Marker key={stop.label} position={stop.coords} icon={stopIcons[i]}>
                        <Popup>
                          <div style={{ minWidth: 160 }}>
                            <div style={{ fontWeight: 800, marginBottom: 4 }}>
                              {i === 0 ? 'Start' : i === DAVAO_DEMO_STOPS.length - 1 ? 'End' : `Via ${i}`}
                            </div>
                            <div style={{ fontSize: 12, color: '#475569' }}>{stop.label}</div>
                          </div>
                        </Popup>
                      </Marker>
                    ))}
                    <Marker position={demoVehiclePos} icon={demoVehicleIcon}>
                      <Popup>
                        <div style={{ fontWeight: 700 }}>Simulated position</div>
                        <div style={{ fontSize: 12, color: '#64748b' }}>{demoProgress}% along route</div>
                      </Popup>
                    </Marker>
                  </>
                ) : (
                  <>
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
                  </>
                )}
                <ZoomControl position="bottomright" />
              </MapContainer>
            )}
            {demoMode && demoRouteLoading && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'rgba(255,255,255,0.7)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                  zIndex: 400,
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'var(--slate-600)',
                }}
              >
                <Loader2 className="animate-spin" size={20} />
                Loading road geometry…
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="card">
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Active Vehicles</h3>
            <div className="space-y-3">
              {demoMode && (
                <p style={{ fontSize: 12, color: 'var(--slate-500)', padding: 12, background: 'var(--slate-50)', borderRadius: 8 }}>
                  Fleet list is hidden during the Davao demo. Exit demo to see live reservations again.
                </p>
              )}
              {!demoMode && trips.map(v => (
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
              {!loading && !demoMode && trips.length === 0 && (
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

          {demoMode && (
            <div className="card">
              <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Demo itinerary</h3>
              <p style={{ fontSize: 12, color: 'var(--slate-500)', marginBottom: 12 }}>
                Same stops as the customer “Track My Trip” page. Multi-city trips are extra vias between Start and End.
              </p>
              <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: 'var(--slate-700)', lineHeight: 1.6 }}>
                {DAVAO_DEMO_STOPS.map(s => (
                  <li key={s.label}>{s.label}</li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </div>

      <div style={{ fontSize: 11, color: 'var(--slate-400)' }}>
        <Navigation size={11} style={{ display: 'inline', marginRight: 4 }} />
        {demoMode
          ? GOOGLE_MAPS_KEY
            ? 'Demo route from Google Directions; blue line matches Google Maps style.'
            : 'Demo uses Mapbox Directions (if set) or OSRM; blue line and truck match the reference layout.'
          : GOOGLE_MAPS_KEY
            ? 'Fleet on Google Maps — click a marker for details. Wire telematics for real GPS.'
            : 'Fleet positions use deterministic spread around Metro Manila until telematics are wired.'}
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
