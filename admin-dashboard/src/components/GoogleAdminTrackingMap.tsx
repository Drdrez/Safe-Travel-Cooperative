import { useEffect, useRef, useState } from 'react';
import { GoogleMap, Marker, Polyline, InfoWindow, useJsApiLoader } from '@react-google-maps/api';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { fetchGoogleDrivingPath } from '@/lib/googleDirections';
import { fetchDrivingRoute } from '@/lib/drivingDirections';
import type { LatLng } from '@/lib/routeGeometry';
import type { DemoStop } from '@/lib/davaoDemoRoute';

/** Inland default when fleet bounds not yet fit (matches Tracking.tsx simulated anchor). */
const FLEET_DEFAULT_CENTER = { lat: 14.5547, lng: 121.0244 };
const DAVAO_CENTER = { lat: 7.0731, lng: 125.6131 };
const ROUTE_BLUE = '#4285F4';

export type FleetTripMarker = {
  id: string;
  vehicleLabel: string;
  driver: string;
  destination: string;
  pickupLabel: string;
  pickupCoords: LatLng | null;
  destinationCoords: LatLng | null;
  pos: [number, number];
  status: string;
  moving: boolean;
};

type Props = {
  apiKey: string;
  demoMode: boolean;
  trips: FleetTripMarker[];
  /** OSRM/Mapbox road paths per trip id (from fetchDrivingRoute). */
  fleetRoadPaths: Record<string, LatLng[]>;
  demoStops: DemoStop[];
  straightDemo: LatLng[];
  demoPolyline: LatLng[];
  demoVehiclePos: LatLng;
  demoRouteReloadNonce: number;
  onDemoPolyline: (path: LatLng[]) => void;
  onDemoRouteLoading: (v: boolean) => void;
};

function truckIconUrl(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24"><rect width="24" height="24" rx="4" fill="#0f172a"/><path fill="#eab308" d="M6 14h12v2H6zm2-4h6v3H8zm9 1.5h2l1.5 2.5H17z"/><circle cx="8.5" cy="17" r="1.2" fill="#fff"/><circle cx="15.5" cy="17" r="1.2" fill="#fff"/></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function escapeSvgText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Same pill + plate treatment as customer Leaflet vehicle icon (readable on Google Maps). */
function fleetVehicleIconUrl(label: string, moving: boolean): string {
  const bg = moving ? '#0f172a' : '#475569';
  const short = label.length > 14 ? `${label.slice(0, 13)}…` : label;
  const text = escapeSvgText(short);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="48" viewBox="0 0 128 48"><rect x="2" y="4" width="124" height="40" rx="12" fill="${bg}" stroke="#eab308" stroke-width="2"/><text x="64" y="30" text-anchor="middle" fill="#ffffff" font-size="11" font-weight="800" font-family="system-ui,Segoe UI,sans-serif">${text}</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export function GoogleAdminTrackingMap(props: Props) {
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'admin-tracking-google-maps',
    googleMapsApiKey: props.apiKey,
    version: 'weekly',
  });

  if (loadError) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontSize: 14, color: 'var(--slate-600)', textAlign: 'center' }}>
        Google Maps failed to load. Set <code>VITE_GOOGLE_MAPS_API_KEY</code> and enable Maps JavaScript API + Directions API.
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
        <Loader2 className="animate-spin" size={22} />
        <span style={{ fontWeight: 600, color: 'var(--slate-600)' }}>Loading Google Maps…</span>
      </div>
    );
  }

  return <GoogleAdminTrackingMapInner {...props} />;
}

function GoogleAdminTrackingMapInner({
  demoMode,
  trips,
  fleetRoadPaths,
  demoStops,
  straightDemo,
  demoPolyline,
  demoVehiclePos,
  demoRouteReloadNonce,
  onDemoPolyline,
  onDemoRouteLoading,
}: Props) {
  const mapRef = useRef<google.maps.Map | null>(null);
  const [fleetInfoId, setFleetInfoId] = useState<string | null>(null);

  useEffect(() => {
    setFleetInfoId(null);
  }, [demoMode]);

  useEffect(() => {
    if (!demoMode) return;
    let cancelled = false;
    (async () => {
      onDemoRouteLoading(true);
      try {
        const path = await fetchGoogleDrivingPath(straightDemo);
        if (!cancelled) {
          onDemoPolyline(path);
          toast.success('Demo route loaded (Google Directions)');
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.warn('Google Directions:', e);
        if (!cancelled) {
          try {
            const { coordinates, source } = await fetchDrivingRoute(straightDemo);
            onDemoPolyline(coordinates);
            toast.info(
              `Google Directions unavailable (${msg}). Using ${source === 'mapbox' ? 'Mapbox' : 'OSRM'} roads on the Google map.`,
            );
          } catch (e2) {
            onDemoPolyline(straightDemo);
            toast.warning(`Road route failed (${msg}). Using straight segments.`);
            console.warn(e2);
          }
        }
      } finally {
        if (!cancelled) onDemoRouteLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [demoMode, demoRouteReloadNonce, straightDemo, onDemoPolyline, onDemoRouteLoading]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (demoMode && demoPolyline.length >= 2) {
      const b = new google.maps.LatLngBounds();
      demoPolyline.forEach(([lat, lng]) => b.extend({ lat, lng }));
      map.fitBounds(b, 56);
      return;
    }
    if (!demoMode && trips.length) {
      const b = new google.maps.LatLngBounds();
      trips.forEach((t) => {
        b.extend({ lat: t.pos[0], lng: t.pos[1] });
        if (t.pickupCoords) b.extend({ lat: t.pickupCoords[0], lng: t.pickupCoords[1] });
        if (t.destinationCoords) b.extend({ lat: t.destinationCoords[0], lng: t.destinationCoords[1] });
        const road = fleetRoadPaths[t.id];
        if (road?.length) {
          road.forEach(([lat, lng]) => b.extend({ lat, lng }));
        }
      });
      const ne = b.getNorthEast();
      const sw = b.getSouthWest();
      if (Math.abs(ne.lat() - sw.lat()) < 0.02 && Math.abs(ne.lng() - sw.lng()) < 0.02) {
        b.extend({ lat: sw.lat() - 0.2, lng: sw.lng() - 0.2 });
        b.extend({ lat: ne.lat() + 0.2, lng: ne.lng() + 0.2 });
      }
      map.fitBounds(b, { top: 48, right: 48, bottom: 48, left: 48 });
      const listener = google.maps.event.addListenerOnce(map, 'idle', () => {
        const z = map.getZoom();
        if (z != null && z > 10) map.setZoom(10);
      });
      return () => {
        google.maps.event.removeListener(listener);
      };
    }
    return undefined;
  }, [demoMode, demoPolyline, trips, fleetRoadPaths]);

  const defaultCenter = demoMode ? DAVAO_CENTER : FLEET_DEFAULT_CENTER;
  const pathLatLng = demoPolyline.map(([lat, lng]) => ({ lat, lng }));

  return (
    <GoogleMap
      mapContainerStyle={{ width: '100%', height: '100%' }}
      center={defaultCenter}
      zoom={demoMode ? 12 : 11}
      options={{
        mapTypeId: 'roadmap',
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: true,
        gestureHandling: 'greedy',
      }}
      onLoad={(m) => {
        mapRef.current = m;
      }}
    >
      {demoMode && (
        <>
          <Polyline
            path={pathLatLng}
            options={{ strokeColor: ROUTE_BLUE, strokeOpacity: 1, strokeWeight: 6 }}
          />
          {demoStops.map((stop, i) => {
            const isEnd = i === demoStops.length - 1;
            const pos = { lat: stop.coords[0], lng: stop.coords[1] };
            return (
              <Marker
                key={stop.label}
                position={pos}
                title={stop.label}
                label={{
                  text: isEnd ? '●' : String(i + 1),
                  color: '#ffffff',
                  fontSize: isEnd ? '14px' : '12px',
                  fontWeight: 'bold',
                }}
                icon={{
                  path: google.maps.SymbolPath.CIRCLE,
                  scale: isEnd ? 16 : 14,
                  fillColor: '#EA4335',
                  fillOpacity: 1,
                  strokeColor: '#ffffff',
                  strokeWeight: 2,
                }}
              />
            );
          })}
          <Marker
            position={{ lat: demoVehiclePos[0], lng: demoVehiclePos[1] }}
            title="Demo unit"
            icon={{
              url: truckIconUrl(),
              scaledSize: new google.maps.Size(40, 40),
              anchor: new google.maps.Point(20, 40),
            }}
          />
        </>
      )}

      {!demoMode && (
        <>
          {trips.map((t) => {
            const road = fleetRoadPaths[t.id];
            if (road && road.length >= 2) {
              return (
                <Polyline
                  key={`fleet-corridor-${t.id}`}
                  path={road.map(([lat, lng]) => ({ lat, lng }))}
                  options={{ strokeColor: ROUTE_BLUE, strokeOpacity: 0.92, strokeWeight: 5 }}
                />
              );
            }
            if (t.pickupCoords && t.destinationCoords) {
              return (
                <Polyline
                  key={`fleet-corridor-${t.id}`}
                  path={[
                    { lat: t.pickupCoords[0], lng: t.pickupCoords[1] },
                    { lat: t.destinationCoords[0], lng: t.destinationCoords[1] },
                  ]}
                  options={{ strokeColor: ROUTE_BLUE, strokeOpacity: 0.8, strokeWeight: 4 }}
                />
              );
            }
            return null;
          })}
          {trips.map((t) => (
            <Marker
              key={t.id}
              position={{ lat: t.pos[0], lng: t.pos[1] }}
              title={`${t.vehicleLabel} — ${t.driver}`}
              onClick={() => setFleetInfoId(t.id)}
              icon={{
                url: fleetVehicleIconUrl(t.vehicleLabel, t.moving),
                scaledSize: new google.maps.Size(128, 48),
                anchor: new google.maps.Point(64, 48),
              }}
            />
          ))}
        </>
      )}

      {!demoMode &&
        fleetInfoId &&
        (() => {
          const t = trips.find((x) => x.id === fleetInfoId);
          if (!t) return null;
          return (
            <InfoWindow
              position={{ lat: t.pos[0], lng: t.pos[1] }}
              onCloseClick={() => setFleetInfoId(null)}
            >
              <div style={{ minWidth: 180, padding: 4 }}>
                <div style={{ fontWeight: 800, marginBottom: 4 }}>{t.vehicleLabel}</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>Driver: {t.driver}</div>
                <div style={{ fontSize: 11, color: '#64748b' }}>From: {t.pickupLabel}</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>To: {t.destination}</div>
                <div style={{ fontSize: 11, fontWeight: 700, marginTop: 4 }}>{t.status}</div>
              </div>
            </InfoWindow>
          );
        })()}
    </GoogleMap>
  );
}
