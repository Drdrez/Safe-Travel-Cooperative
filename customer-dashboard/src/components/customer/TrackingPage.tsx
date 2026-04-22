import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Link } from 'react-router';
import { Navigation, RefreshCw, Phone, Shield, Activity, MessageSquare, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';

import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { getMapTileLayerConfig } from '../../lib/mapTiles';
import { supabase } from '../../lib/supabase';
import { useRealtimeRefresh } from '../../lib/useRealtimeRefresh';
import {
  geocodeAddress,
  destinationLooksMisplacedForTandag,
  tripLikelyDavaoLocalButCoordsFarApart,
} from '../../lib/geocodePhoton';
import {
  positionAlongPolyline,
  stopArcLengthsOnRoute,
  getActiveLegByArcLength,
  polylinePlanarLength,
  polylineLengthMeters,
  formatEtaMinutesFromRemainingKm,
  type LatLng,
} from '../../lib/routeGeometry';
import { fetchDrivingRoute } from '../../lib/drivingDirections';
import { GoogleCustomerTrackingMap } from './GoogleCustomerTrackingMap';

const GOOGLE_MAPS_KEY = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined)?.trim() ?? '';

type RouteStop = { label: string; coords: LatLng };

let DefaultIcon = L.icon({
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

function vehicleIconHtml(plate: string) {
  return `
    <div style="background: var(--slate-900); padding: 8px 12px; border-radius: 20px; display: flex; align-items: center; gap: 8px; box-shadow: var(--shadow-lg); white-space: nowrap; transform: translate(-50%, -100%); margin-top: -10px;">
       <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#eab308" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>
       <span style="color: white; font-size: 10px; font-weight: 800;">${plate}</span>
    </div>
  `;
}

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

type TrackingExperienceProps = {
  reservationIdStr: string;
  reservationStatus: string;
  tripStops: RouteStop[];
  vehicleLabel: string;
  driverName: string;
  driverPhone: string;
};

function TrackingExperience({
  reservationIdStr,
  reservationStatus,
  tripStops,
  vehicleLabel,
  driverName,
  driverPhone,
}: TrackingExperienceProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationKind, setSimulationKind] = useState<'trip' | 'arrival' | null>(null);
  const initialProgress = reservationStatus === 'In Progress' ? 38 : reservationStatus === 'Confirmed' ? 12 : 8;
  const [progress, setProgress] = useState(initialProgress);

  const pickup = tripStops[0].coords;
  const straightMain = useMemo(() => tripStops.map((s) => s.coords), [tripStops]);
  const stagingPoint = useMemo((): LatLng => [pickup[0] - 0.012, pickup[1] - 0.014], [pickup]);
  const straightArrival = useMemo((): LatLng[] => [stagingPoint, pickup], [stagingPoint, pickup]);

  const [mainPolyline, setMainPolyline] = useState<LatLng[]>(() => tripStops.map((s) => s.coords));
  const [arrivalPolyline, setArrivalPolyline] = useState<LatLng[]>(() => [stagingPoint, pickup]);
  const [tripRouteSource, setTripRouteSource] = useState<'google' | 'mapbox' | 'osrm' | 'straight'>('straight');
  const [routesLoading, setRoutesLoading] = useState(true);
  const [routeReloadNonce, setRouteReloadNonce] = useState(0);

  const [currentPos, setCurrentPos] = useState<LatLng>(() =>
    positionAlongPolyline(
      tripStops.map((s) => s.coords),
      initialProgress / 100,
    ),
  );
  const simulationRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mapTiles = useMemo(() => getMapTileLayerConfig(), []);
  const vehicleLeafletIcon = useMemo(
    () =>
      L.divIcon({
        className: 'custom-div-icon',
        html: vehicleIconHtml(vehicleLabel),
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      }),
    [vehicleLabel],
  );

  const stopIcons = useMemo(
    () => tripStops.map((_, i) => numberedStopIcon(i, i === tripStops.length - 1)),
    [tripStops],
  );

  const mapAreaCenter = useMemo(() => {
    const lats = tripStops.map((s) => s.coords[0]);
    const lngs = tripStops.map((s) => s.coords[1]);
    return {
      lat: (Math.min(...lats) + Math.max(...lats)) / 2,
      lng: (Math.min(...lngs) + Math.max(...lngs)) / 2,
    };
  }, [tripStops]);

  const mapCenter = useMemo((): LatLng => {
    const lats = mainPolyline.map((c) => c[0]);
    const lngs = mainPolyline.map((c) => c[1]);
    return [(Math.min(...lats) + Math.max(...lats)) / 2, (Math.min(...lngs) + Math.max(...lngs)) / 2];
  }, [mainPolyline]);

  const stopArcs = useMemo(
    () => stopArcLengthsOnRoute(tripStops.map((s) => s.coords), mainPolyline),
    [tripStops, mainPolyline],
  );
  const planarTotal = useMemo(() => polylinePlanarLength(mainPolyline), [mainPolyline]);
  const tripLengthM = useMemo(() => polylineLengthMeters(mainPolyline), [mainPolyline]);
  const arrivalLengthM = useMemo(() => polylineLengthMeters(arrivalPolyline), [arrivalPolyline]);

  const { from, to } = getActiveLegByArcLength(progress, stopArcs, planarTotal);
  const segIdx = from;

  const loadRoutes = useCallback(async (): Promise<{ main: LatLng[] }> => {
    if (GOOGLE_MAPS_KEY) {
      setRouteReloadNonce((n) => n + 1);
      return { main: straightMain };
    }

    setRoutesLoading(true);
    const stops = tripStops.map((s) => s.coords);
    const arrivalWpts: LatLng[] = [stagingPoint, pickup];

    const [tripRes, arrRes] = await Promise.allSettled([
      fetchDrivingRoute(stops),
      fetchDrivingRoute(arrivalWpts),
    ]);

    let nextMain: LatLng[] = straightMain;
    if (tripRes.status === 'fulfilled') {
      nextMain = tripRes.value.coordinates;
      setMainPolyline(nextMain);
      setTripRouteSource(tripRes.value.source);
    } else {
      console.warn(tripRes.reason);
      setMainPolyline(straightMain);
      setTripRouteSource('straight');
      toast.error('Trip route could not be loaded; using straight lines. Check network or Mapbox token.');
    }

    if (arrRes.status === 'fulfilled') {
      setArrivalPolyline(arrRes.value.coordinates);
    } else {
      console.warn(arrRes.reason);
      setArrivalPolyline(straightArrival);
    }

    setRoutesLoading(false);
    return { main: nextMain };
  }, [pickup, straightMain, straightArrival, stagingPoint, tripStops]);

  const onMainPolyline = useCallback((path: LatLng[]) => setMainPolyline(path), []);
  const onArrivalPolyline = useCallback((path: LatLng[]) => setArrivalPolyline(path), []);
  const onRouteSource = useCallback((source: 'google' | 'mapbox' | 'osrm' | 'straight') => setTripRouteSource(source), []);
  const onRoutesLoading = useCallback((v: boolean) => setRoutesLoading(v), []);

  useEffect(() => {
    if (GOOGLE_MAPS_KEY) return;
    loadRoutes();
  }, [GOOGLE_MAPS_KEY, loadRoutes]);

  useEffect(() => {
    if (isSimulating) return;
    setCurrentPos(positionAlongPolyline(mainPolyline, progress / 100));
  }, [mainPolyline, isSimulating, progress]);

  useEffect(() => {
    return () => {
      if (simulationRef.current) {
        clearInterval(simulationRef.current);
        simulationRef.current = null;
      }
    };
  }, []);
  const legSnippet =
    simulationKind === 'arrival'
      ? 'Driver heading to your pickup address'
      : tripStops.length >= 2
        ? `En route: ${tripStops[from]?.label?.split('—')[0]?.trim() ?? 'Start'} → ${tripStops[to]?.label?.split('—')[0]?.trim() ?? 'End'}`
        : 'En route';

  const destStop = tripStops[tripStops.length - 1];
  const startStop = tripStops[0];

  const trackingData = {
    reservationId: reservationIdStr,
    driverName,
    driverPhone,
    currentLocation:
      simulationKind === 'arrival'
        ? progress < 50
          ? 'Approaching your pickup area'
          : 'Near your pickup point'
        : progress >= 100
          ? destStop.label
          : progress > 66
            ? 'Nearing destination'
            : progress > 33
              ? 'En route'
              : 'Departed pickup',
    destinationName: destStop.label,
    startLabel: startStop.label,
    status:
      reservationStatus === 'Pending'
        ? 'Awaiting confirmation'
        : progress < 100
          ? reservationStatus === 'In Progress'
            ? 'In transit'
            : 'Confirmed'
          : 'Arrived (simulated)',
    estimatedArrival:
      progress >= 100
        ? 'Arrived'
        : simulationKind === 'arrival'
          ? formatEtaMinutesFromRemainingKm(((100 - progress) / 100) * (arrivalLengthM / 1000))
          : formatEtaMinutesFromRemainingKm(((100 - progress) / 100) * (tripLengthM / 1000)),
    lastUpdate: 'Just now',
    eta:
      progress >= 100
        ? 'Arrived'
        : simulationKind === 'arrival'
          ? formatEtaMinutesFromRemainingKm(((100 - progress) / 100) * (arrivalLengthM / 1000))
          : (() => {
              const remKm = ((100 - progress) / 100) * (tripLengthM / 1000);
              const mins = Math.max(1, Math.round((remKm / 32) * 60));
              return new Date(Date.now() + mins * 60000).toLocaleTimeString(undefined, {
                hour: 'numeric',
                minute: '2-digit',
              });
            })(),
  };

  const clearSimulation = () => {
    if (simulationRef.current) {
      clearInterval(simulationRef.current);
      simulationRef.current = null;
    }
  };

  const startSimulation = () => {
    if (isSimulating) return;
    clearSimulation();
    setIsSimulating(true);
    setSimulationKind('trip');
    setProgress(0);
    setCurrentPos(positionAlongPolyline(mainPolyline, 0));
    toast.success('Trip simulation along your booked route');

    let currentProgress = 0;
    simulationRef.current = setInterval(() => {
        currentProgress += 1;
        setProgress(currentProgress);
        setCurrentPos(positionAlongPolyline(mainPolyline, currentProgress / 100));

        if (currentProgress >= 100) {
            clearSimulation();
            setIsSimulating(false);
            setSimulationKind(null);
            toast.success('Simulation complete: arrived at final stop');
        }
    }, 120);
  };

  const startArrivalSimulation = () => {
    if (isSimulating) return;
    clearSimulation();
    setIsSimulating(true);
    setSimulationKind('arrival');
    setProgress(0);
    setCurrentPos(positionAlongPolyline(arrivalPolyline, 0));
    toast.info('Driver is heading to your pickup location');

    let currentProgress = 0;
    simulationRef.current = setInterval(() => {
        currentProgress += 1;
        setProgress(currentProgress);
        setCurrentPos(positionAlongPolyline(arrivalPolyline, currentProgress / 100));

        if (currentProgress === 80) {
            toast.success('Your driver is just 2 minutes away!');
        }

        if (currentProgress >= 100) {
            clearSimulation();
            setIsSimulating(false);
            setSimulationKind(null);
            toast.success('Your driver has arrived at the pickup location!');
        }
    }, 120);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    toast.info('Refreshing map and road routes…');
    if (GOOGLE_MAPS_KEY) {
      setRouteReloadNonce((n) => n + 1);
    } else {
      const { main } = await loadRoutes();
      if (!isSimulating) {
        setCurrentPos(positionAlongPolyline(main, progress / 100));
      }
    }
    setIsRefreshing(false);
    toast.success('Routes and position updated');
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="page-header">
        <div>
          <h1>Track My Trip</h1>
          <p>
            Map and route reflect <strong>this booking’s pickup and destination</strong>.{' '}
            {reservationStatus === 'Pending' && 'Pending confirmation — preview only.'}{' '}
            {GOOGLE_MAPS_KEY
              ? 'Basemap: Google Maps. Driving line: Google Directions when available; otherwise an alternate road network.'
              : 'Configure a Google Maps API key in the deployment environment to enable the Google basemap.'}
          </p>
        </div>
        <div className="page-header-actions" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
           <button onClick={startArrivalSimulation} disabled={isSimulating || routesLoading} className="btn btn-outline btn-sm" style={{ border: '1px solid var(--emerald-200)', color: 'var(--emerald-600)' }}>
             <Navigation size={14} className={isSimulating ? 'animate-pulse' : ''} /> Simulate Arrival
           </button>
           <button onClick={startSimulation} disabled={isSimulating || routesLoading} className="btn btn-brand btn-sm">
             <Activity size={14} className={isSimulating ? 'animate-pulse' : ''} /> Live Trip Simulation
           </button>
           <button onClick={handleRefresh} disabled={isRefreshing} className="btn btn-outline btn-sm">
             <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} /> Refresh Map
           </button>
        </div>
      </div>

      <div className="customer-tracking-layout">
        {/* Left Column: Status & Driver */}
        <div className="space-y-6">
           {/* Progress Card */}
           <div className="card" style={{ padding: 24 }}>
              <div className="tracking-progress-header" style={{ marginBottom: 20 }}>
                 <div>
                    <span className="status-badge" style={{ marginBottom: 4, background: 'var(--brand-gold-light)', color: 'var(--brand-gold-dark)' }}>{trackingData.status}</span>
                    <h3 style={{ fontSize: 20, fontWeight: 800 }}>{isSimulating ? 'Simulating Trip...' : 'Track My Journey'}</h3>
                 </div>
                 <div>
                    <p style={{ fontSize: 11, color: 'var(--slate-400)', textTransform: 'uppercase' }}>Trip ID</p>
                    <p style={{ fontWeight: 800 }}>{trackingData.reservationId}</p>
                 </div>
              </div>

              <div className="space-y-4">
                 <div style={{ width: '100%', height: 8, background: 'var(--slate-100)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${progress}%`, height: '100%', background: 'var(--brand-gold)', borderRadius: 4, transition: 'width 0.15s linear' }} />
                 </div>
                 <div className="flex-between">
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--slate-500)' }}>Current Progress</span>
                    <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--brand-gold-dark)' }}>{progress}% Complete</span>
                 </div>
              </div>

              <div className="customer-modal-grid-2" style={{ marginTop: 24 }}>
                 <div style={{ padding: 16, background: 'var(--slate-50)', borderRadius: 12 }}>
                    <p style={{ fontSize: 11, color: 'var(--slate-400)', marginBottom: 4 }}>ETA</p>
                    <p style={{ fontSize: 16, fontWeight: 800 }}>{trackingData.eta}</p>
                 </div>
                 <div style={{ padding: 16, background: 'var(--slate-50)', borderRadius: 12 }}>
                    <p style={{ fontSize: 11, color: 'var(--slate-400)', marginBottom: 4 }}>Remaining</p>
                    <p style={{ fontSize: 16, fontWeight: 800 }}>{trackingData.estimatedArrival}</p>
                 </div>
              </div>
           </div>

           {/* Driver Card */}
           <div className="card" style={{ padding: 24 }}>
              <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 24 }}>
                 <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--slate-100)', overflow: 'hidden', border: '2px solid var(--brand-gold)' }}>
                    <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(trackingData.driverName)}&background=EAB308&color=fff`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                 </div>
                 <div>
                    <h4 style={{ fontSize: 16, fontWeight: 800, marginBottom: 2 }}>{trackingData.driverName}</h4>
                    <p style={{ fontSize: 12, color: 'var(--slate-500)' }}>Safe Travel Cooperative Driver</p>
                    <div className="flex-start" style={{ gap: 4, marginTop: 4 }}>
                       <Shield size={12} className="text-brand-gold" />
                       <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--brand-gold-dark)' }}>Verified Driver</span>
                    </div>
                 </div>
              </div>
              <div className="customer-driver-actions">
                 <button className="btn btn-outline w-full" style={{ gap: 8 }}>
                    <MessageSquare size={16} /> Chat
                 </button>
                 <button 
                  className="btn btn-brand w-full" 
                  style={{ gap: 8 }}
                  disabled={!trackingData.driverPhone || trackingData.driverPhone === '—'}
                  onClick={() => {
                    const p = trackingData.driverPhone.replace(/[^\d+]/g, '');
                    if (p) window.location.href = `tel:${p}`;
                  }}
                 >
                    <Phone size={16} /> Contact
                 </button>
              </div>
           </div>
        </div>

        {/* Right Column: Live Map & Location Details */}
        <div className="space-y-6">
           {!GOOGLE_MAPS_KEY && import.meta.env.PROD && (
              <div
                className="card"
                style={{
                  padding: '12px 16px',
                  background: '#fffbeb',
                  border: '1px solid #fcd34d',
                  fontSize: 13,
                  color: '#92400e',
                  lineHeight: 1.5,
                }}
              >
                <strong>Map mode:</strong> This deployment was built <strong>without</strong>{' '}
                <code style={{ fontSize: 12 }}>VITE_GOOGLE_MAPS_API_KEY</code>, so you see Leaflet. In Vercel →{' '}
                <em>this customer-dashboard project</em> → Settings → Environment Variables, add that key for{' '}
                <strong>Production</strong>, then <strong>Redeploy</strong>. Root Directory must be{' '}
                <code style={{ fontSize: 12 }}>customer-dashboard</code>.
              </div>
           )}
           <div className="card customer-tracking-map-card" style={{ padding: 0, position: 'relative', overflow: 'hidden', border: '1px solid var(--slate-200)', zIndex: 0 }}>
              {GOOGLE_MAPS_KEY ? (
                <GoogleCustomerTrackingMap
                  apiKey={GOOGLE_MAPS_KEY}
                  mapAreaCenter={mapAreaCenter}
                  tripStops={tripStops}
                  stagingPoint={stagingPoint}
                  pickup={pickup}
                  straightMain={straightMain}
                  straightArrival={straightArrival}
                  mainPolyline={mainPolyline}
                  arrivalPolyline={arrivalPolyline}
                  currentPos={currentPos}
                  simulationKind={simulationKind}
                  isSimulating={isSimulating}
                  routeReloadNonce={routeReloadNonce}
                  vehicleLabel={vehicleLabel}
                  onMainPolyline={onMainPolyline}
                  onArrivalPolyline={onArrivalPolyline}
                  onRouteSource={onRouteSource}
                  onRoutesLoading={onRoutesLoading}
                />
              ) : (
              <MapContainer 
                center={mapCenter} 
                zoom={mapTiles.tileSize === 512 ? 12 : 11} 
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
                <FitRouteBounds positions={mainPolyline} />
                <FollowVehicle position={currentPos} enabled={isSimulating} />

                <Polyline
                  positions={mainPolyline}
                  pathOptions={{
                    color: '#d97706',
                    weight: 5,
                    opacity: simulationKind === 'arrival' ? 0.35 : 0.9,
                  }}
                />
                {simulationKind === 'arrival' && (
                  <Polyline
                    positions={arrivalPolyline}
                    pathOptions={{ color: '#059669', weight: 4, opacity: 0.95, dashArray: '8 12' }}
                  />
                )}

                {tripStops.map((stop, i) => (
                  <Marker key={stop.label} position={stop.coords} icon={stopIcons[i]}>
                    <Popup>
                      <div style={{ minWidth: 160 }}>
                        <div style={{ fontWeight: 800, marginBottom: 4 }}>
                          {i === 0 ? 'Start' : i === tripStops.length - 1 ? 'End' : `Via ${i}`}
                        </div>
                        <div style={{ fontSize: 12, color: '#475569' }}>{stop.label}</div>
                      </div>
                    </Popup>
                  </Marker>
                ))}

                <Marker position={currentPos} icon={vehicleLeafletIcon}>
                    <Popup>
                      <div style={{ fontWeight: 800, marginBottom: 4 }}>Live position</div>
                      <div style={{ fontSize: 12, color: '#475569' }}>{trackingData.currentLocation}</div>
                      {simulationKind !== 'arrival' && progress < 100 && (
                        <div style={{ fontSize: 11, color: '#64748b', marginTop: 6 }}>{legSnippet}</div>
                      )}
                    </Popup>
                </Marker>

                <ZoomControl position="bottomright" />
              </MapContainer>
              )}
              
              <div style={{ position: 'absolute', top: 16, right: 16, zIndex: 1000, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, pointerEvents: 'none' }}>
                 <div className="flex-start" style={{ background: 'white', padding: '8px 12px', borderRadius: 20, boxShadow: 'var(--shadow-md)', border: '1px solid var(--slate-100)', pointerEvents: 'auto' }}>
                    <Activity size={14} className={isSimulating ? "text-emerald-500 animate-pulse" : "text-slate-300"} />
                    <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--slate-500)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {isSimulating ? 'GPS Live Feed' : 'GPS Standby'}
                    </span>
                 </div>
                 <div style={{ background: 'white', padding: '6px 10px', borderRadius: 12, boxShadow: 'var(--shadow-sm)', border: '1px solid var(--slate-100)', fontSize: 10, fontWeight: 600, color: 'var(--slate-500)', maxWidth: 280, textAlign: 'right', pointerEvents: 'auto' }}>
                    {GOOGLE_MAPS_KEY ? (
                      <>
                        Map: Google Maps
                        <br />
                        Route:{' '}
                        {tripRouteSource === 'google'
                          ? 'Google Directions'
                          : tripRouteSource === 'mapbox'
                            ? 'Mapbox (on Google map)'
                            : tripRouteSource === 'osrm'
                              ? 'OSRM (on Google map)'
                              : 'Straight'}
                        {routesLoading ? ' · loading…' : ` · ${(tripLengthM / 1000).toFixed(1)} km trip`}
                      </>
                    ) : (
                      <>
                        Map: {mapTiles.provider === 'mapbox' ? 'Mapbox Streets' : mapTiles.provider === 'maptiler' ? 'MapTiler Streets' : 'CARTO Voyager'}
                        <br />
                        Roads:{' '}
                        {tripRouteSource === 'mapbox'
                          ? 'Mapbox Directions'
                          : tripRouteSource === 'osrm'
                            ? 'OSRM (OpenStreetMap)'
                            : 'Straight fallback'}
                        {routesLoading ? ' · loading…' : ` · ${(tripLengthM / 1000).toFixed(1)} km trip`}
                      </>
                    )}
                 </div>
              </div>
              {routesLoading && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'rgba(255,255,255,0.72)',
                    zIndex: 500,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 10,
                    fontSize: 14,
                    fontWeight: 600,
                    color: 'var(--slate-600)',
                  }}
                >
                  <Loader2 className="animate-spin" size={22} />
                  Loading road geometry…
                </div>
              )}
           </div>

           <div className="card" style={{ padding: 24 }}>
              <h4 style={{ fontSize: 14, fontWeight: 800, marginBottom: 12, color: 'var(--slate-900)' }}>Itinerary</h4>
              <p style={{ fontSize: 12, color: 'var(--slate-500)', marginBottom: 16, lineHeight: 1.5 }}>
                Stops are ordered: <strong style={{ color: 'var(--slate-800)' }}>Start</strong> is always the first pin,{' '}
                <strong style={{ color: 'var(--slate-800)' }}>End</strong> is the last. Extra cities or areas are extra vias in between.
              </p>
              {simulationKind === 'arrival' && (
                <p style={{ fontSize: 12, color: 'var(--emerald-700)', marginBottom: 16, fontWeight: 600 }}>
                  Live: driver on approach leg (staging → your pickup). Full route shown dimmed for context.
                </p>
              )}
              {simulationKind !== 'arrival' && progress < 100 && (
                <p style={{ fontSize: 12, color: 'var(--slate-600)', marginBottom: 16, fontWeight: 600 }}>{legSnippet}</p>
              )}
              <div className="space-y-4" style={{ maxHeight: 320, overflowY: 'auto' }}>
                 {tripStops.map((stop, i) => {
                    const isFirst = i === 0;
                    const isLast = i === tripStops.length - 1;
                    const role = isFirst ? 'Start' : isLast ? 'End' : `Via ${i}`;
                    let rowState: 'done' | 'next' | 'pending' = 'pending';
                    if (tripStops.length === 2) {
                      if (simulationKind === 'arrival') {
                        rowState = isFirst ? (progress >= 100 ? 'done' : 'next') : isLast ? 'pending' : 'pending';
                      } else if (progress >= 100) {
                        rowState = 'done';
                      } else if (isFirst) {
                        rowState = progress > 8 ? 'done' : 'next';
                      } else {
                        rowState = 'next';
                      }
                    } else if (simulationKind === 'arrival') {
                      rowState = isFirst ? (progress >= 100 ? 'done' : 'next') : 'pending';
                    } else if (progress >= 100) {
                      rowState = 'done';
                    } else if (i < to && (i < from || (i === from && progress > 0))) {
                      rowState = 'done';
                    } else if (i === to) {
                      rowState = 'next';
                    }
                    const muted = rowState === 'done';
                    const bold = rowState === 'next';
                    return (
                      <div
                        key={`${i}-${stop.label}`}
                        className="flex-start"
                        style={{
                          alignItems: 'flex-start',
                          opacity: muted ? 0.55 : 1,
                          padding: '10px 12px',
                          borderRadius: 10,
                          background: bold ? 'var(--brand-gold-light)' : 'transparent',
                          border: bold ? '1px solid var(--brand-gold)' : '1px solid transparent',
                        }}
                      >
                        <div
                          style={{
                            minWidth: 22,
                            height: 22,
                            borderRadius: '50%',
                            background: isLast ? 'var(--slate-900)' : 'var(--slate-200)',
                            color: isLast ? '#fff' : 'var(--slate-700)',
                            fontSize: 11,
                            fontWeight: 800,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginTop: 2,
                          }}
                        >
                          {isLast ? '●' : i + 1}
                        </div>
                        <div style={{ paddingLeft: 12 }}>
                           <p style={{ fontSize: 10, color: 'var(--slate-400)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{role}</p>
                           <p style={{ fontSize: 14, fontWeight: bold ? 800 : 600 }}>{stop.label}</p>
                        </div>
                      </div>
                    );
                 })}
              </div>
              <div className="flex-start" style={{ alignItems: 'flex-start', marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--slate-100)' }}>
                 <Activity size={16} className="text-brand-gold" style={{ marginTop: 2 }} />
                 <div style={{ paddingLeft: 12 }}>
                    <p style={{ fontSize: 10, color: 'var(--slate-400)', textTransform: 'uppercase' }}>Live vehicle position</p>
                    <p style={{ fontSize: 14, fontWeight: 700 }}>{trackingData.currentLocation}</p>
                 </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}

type LoadedReservation = {
  id: string;
  reservation_id_str: string;
  status: string;
  pickup_location: string;
  destination: string;
  start_date: string;
  pickup_lat: number | null;
  pickup_lng: number | null;
  destination_lat: number | null;
  destination_lng: number | null;
  vehicles: { plate_number: string | null; model: string | null } | null;
  profiles: { full_name: string | null; contact_number: string | null } | null;
};

function formatDriverPhone(raw: string | null | undefined): string {
  if (!raw?.trim()) return '';
  return raw.trim();
}

export default function TrackingPage() {
  const [loadState, setLoadState] = useState<'loading' | 'auth' | 'empty' | 'ready' | 'awaiting'>('loading');
  const [awaitingRow, setAwaitingRow] = useState<LoadedReservation | null>(null);
  const [payload, setPayload] = useState<{
    row: LoadedReservation;
    tripStops: RouteStop[];
    vehicleLabel: string;
    driverName: string;
    driverPhone: string;
  } | null>(null);

  const load = useCallback(async () => {
    setLoadState('loading');
    setAwaitingRow(null);
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;
    if (!user) {
      setLoadState('auth');
      setPayload(null);
      return;
    }

    const sel =
      'id, reservation_id_str, status, pickup_location, destination, pickup_lat, pickup_lng, destination_lat, destination_lng, start_date, vehicles(plate_number, model), profiles!reservations_driver_id_fkey(full_name, contact_number)';

    const { data: activeRow, error: activeErr } = await supabase
      .from('reservations')
      .select(sel)
      .eq('customer_id', user.id)
      .in('status', ['Confirmed', 'In Progress'])
      .order('start_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (activeErr) {
      console.warn(activeErr);
      if (/pickup_lat|column|does not exist/i.test(activeErr.message)) {
        toast.error('Database update needed: run supabase/migrations/015_reservation_trip_coordinates.sql');
      }
      setLoadState('empty');
      setPayload(null);
      return;
    }

    if (activeRow) {
      let row = activeRow as LoadedReservation;
      let puLat = row.pickup_lat as number | null;
      let puLng = row.pickup_lng as number | null;
      let deLat = row.destination_lat as number | null;
      let deLng = row.destination_lng as number | null;

      if (puLat == null || puLng == null || deLat == null || deLng == null) {
        const [pGeo, dGeo] = await Promise.all([
          geocodeAddress(row.pickup_location || ''),
          geocodeAddress(row.destination || ''),
        ]);
        if (pGeo && dGeo) {
          puLat = pGeo.lat;
          puLng = pGeo.lng;
          deLat = dGeo.lat;
          deLng = dGeo.lng;
          await supabase
            .from('reservations')
            .update({
              pickup_lat: pGeo.lat,
              pickup_lng: pGeo.lng,
              destination_lat: dGeo.lat,
              destination_lng: dGeo.lng,
            })
            .eq('id', row.id);
        }
      }

      if (deLat != null && deLng != null && destinationLooksMisplacedForTandag(row.destination || '', deLat, deLng)) {
        const fix = await geocodeAddress(row.destination || '');
        if (fix) {
          deLat = fix.lat;
          deLng = fix.lng;
          toast.info('Map destination adjusted to Tandag City to match your booking address.');
          await supabase
            .from('reservations')
            .update({ destination_lat: fix.lat, destination_lng: fix.lng })
            .eq('id', row.id);
        }
      }

      if (
        puLat != null &&
        puLng != null &&
        deLat != null &&
        deLng != null &&
        tripLikelyDavaoLocalButCoordsFarApart(row.pickup_location || '', row.destination || '', puLat, puLng, deLat, deLng)
      ) {
        const [pGeo, dGeo] = await Promise.all([
          geocodeAddress(`${String(row.pickup_location).trim()}, Davao City, Davao del Sur, Philippines`),
          geocodeAddress(`${String(row.destination).trim()}, Davao City, Davao del Sur, Philippines`),
        ]);
        if (pGeo && dGeo) {
          puLat = pGeo.lat;
          puLng = pGeo.lng;
          deLat = dGeo.lat;
          deLng = dGeo.lng;
          toast.info('Map route corrected to Davao City for your pickup and destination.');
          await supabase
            .from('reservations')
            .update({
              pickup_lat: pGeo.lat,
              pickup_lng: pGeo.lng,
              destination_lat: dGeo.lat,
              destination_lng: dGeo.lng,
            })
            .eq('id', row.id);
        }
      }

      if (puLat == null || puLng == null || deLat == null || deLng == null) {
        setLoadState('empty');
        setPayload(null);
        return;
      }

      const tripStops: RouteStop[] = [
        { label: `Pickup — ${row.pickup_location}`, coords: [puLat, puLng] },
        { label: `Destination — ${row.destination}`, coords: [deLat, deLng] },
      ];

      const vehicleLabel =
        row.vehicles?.plate_number?.trim() || row.vehicles?.model?.trim() || 'Vehicle TBD';

      const driverName = row.profiles?.full_name?.trim() || 'Driver assigned at dispatch';
      const driverPhone = formatDriverPhone(row.profiles?.contact_number);

      setPayload({
        row,
        tripStops,
        vehicleLabel,
        driverName,
        driverPhone: driverPhone || '—',
      });
      setLoadState('ready');
      return;
    }

    const { data: pendingRow, error: pendErr } = await supabase
      .from('reservations')
      .select(sel)
      .eq('customer_id', user.id)
      .eq('status', 'Pending')
      .order('start_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (pendErr) {
      console.warn(pendErr);
      setLoadState('empty');
      setPayload(null);
      return;
    }

    if (pendingRow) {
      setAwaitingRow(pendingRow as LoadedReservation);
      setPayload(null);
      setLoadState('awaiting');
      return;
    }

    setLoadState('empty');
    setPayload(null);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useRealtimeRefresh('reservations', () => {
    void load();
  });

  if (loadState === 'loading') {
    return (
      <div className="space-y-8" style={{ padding: 48, textAlign: 'center' }}>
        <Loader2 className="animate-spin" size={32} style={{ color: 'var(--slate-400)', margin: '0 auto', display: 'block' }} />
        <p style={{ color: 'var(--slate-500)', fontWeight: 600 }}>Loading your trip…</p>
      </div>
    );
  }

  if (loadState === 'auth') {
    return (
      <div className="space-y-8 animate-in fade-in" style={{ padding: 48, maxWidth: 480, margin: '0 auto' }}>
        <h1>Track My Trip</h1>
        <p style={{ color: 'var(--slate-600)' }}>Sign in to see the map for your active booking.</p>
        <Link to="/login" className="btn btn-brand">
          Sign in
        </Link>
      </div>
    );
  }

  if (loadState === 'awaiting' && awaitingRow) {
    const when =
      awaitingRow.start_date && !Number.isNaN(new Date(awaitingRow.start_date).getTime())
        ? new Date(awaitingRow.start_date).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
        : null;
    return (
      <div className="space-y-8 animate-in fade-in" style={{ padding: 48, maxWidth: 560, margin: '0 auto' }}>
        <h1>Track My Trip</h1>
        <p style={{ color: 'var(--slate-600)', lineHeight: 1.6 }}>
          Live map and progress appear after the cooperative confirms your booking. This request is still pending.
        </p>
        <div
          className="card"
          style={{ padding: 24, border: '1px solid var(--slate-200)', borderRadius: 12, background: 'var(--slate-50, #f8fafc)' }}
        >
          <p style={{ margin: 0, fontSize: 12, fontWeight: 700, letterSpacing: 0.06, textTransform: 'uppercase', color: 'var(--slate-500)' }}>
            Awaiting confirmation
          </p>
          <p style={{ margin: '8px 0 0', fontSize: 20, fontWeight: 800, color: 'var(--slate-900)' }}>{awaitingRow.reservation_id_str}</p>
          {when && (
            <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--slate-600)' }}>{when}</p>
          )}
          <div style={{ marginTop: 16, display: 'grid', gap: 10, fontSize: 14, color: 'var(--slate-700)' }}>
            <p style={{ margin: 0 }}>
              <span style={{ fontWeight: 700 }}>Pickup: </span>
              {awaitingRow.pickup_location || '—'}
            </p>
            <p style={{ margin: 0 }}>
              <span style={{ fontWeight: 700 }}>Destination: </span>
              {awaitingRow.destination || '—'}
            </p>
          </div>
        </div>
        <p style={{ color: 'var(--slate-500)', fontSize: 13, lineHeight: 1.5 }}>
          If you did not start a booking, check &quot;My reservations&quot; for an old draft or test record you can cancel.
        </p>
        <div className="flex-start gap-3" style={{ flexWrap: 'wrap' }}>
          <Link to="/customer/reservations" className="btn btn-brand">
            My reservations
          </Link>
          <Link to="/customer/make-reservation" className="btn btn-outline">
            New reservation
          </Link>
        </div>
      </div>
    );
  }

  if (loadState === 'empty') {
    return (
      <div className="space-y-8 animate-in fade-in" style={{ padding: 48, maxWidth: 560, margin: '0 auto' }}>
        <h1>Track My Trip</h1>
        <p style={{ color: 'var(--slate-600)', lineHeight: 1.6 }}>
          No active trip to track. When a booking is confirmed, you can follow the route here. If the map is blank for a
          confirmed trip, your project may need the coordinates migration
          (<code style={{ fontSize: 12 }}>015_reservation_trip_coordinates.sql</code>).
        </p>
        <div className="flex-start gap-3" style={{ flexWrap: 'wrap' }}>
          <Link to="/customer/make-reservation" className="btn btn-brand">
            New reservation
          </Link>
          <Link to="/customer/reservations" className="btn btn-outline">
            My reservations
          </Link>
        </div>
      </div>
    );
  }

  if (loadState !== 'ready' || !payload) {
    return null;
  }

  return (
    <TrackingExperience
      key={payload.row.id}
      reservationIdStr={payload.row.reservation_id_str}
      reservationStatus={payload.row.status}
      tripStops={payload.tripStops}
      vehicleLabel={payload.vehicleLabel}
      driverName={payload.driverName}
      driverPhone={payload.driverPhone}
    />
  );
}

function FitRouteBounds({ positions }: { positions: LatLng[] }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length < 2) return;
    map.fitBounds(L.latLngBounds(positions), { padding: [52, 52], maxZoom: 13 });
  }, [map, positions]);
  return null;
}

function FollowVehicle({ position, enabled }: { position: LatLng; enabled: boolean }) {
  const map = useMap();
  useEffect(() => {
    if (!enabled) return;
    map.panTo(position);
  }, [map, position, enabled]);
  return null;
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