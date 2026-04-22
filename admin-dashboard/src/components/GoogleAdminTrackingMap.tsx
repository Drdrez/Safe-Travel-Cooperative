import { useEffect, useRef, useState } from 'react';
import { GoogleMap, Marker, Polyline, InfoWindow, useJsApiLoader } from '@react-google-maps/api';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { fetchGoogleDrivingPath } from '@/lib/googleDirections';
import type { LatLng } from '@/lib/routeGeometry';
import type { DemoStop } from '@/lib/davaoDemoRoute';

const MANILA_CENTER = { lat: 14.5995, lng: 120.9842 };
const DAVAO_CENTER = { lat: 7.0731, lng: 125.6131 };
const ROUTE_BLUE = '#4285F4';

export type FleetTripMarker = {
  id: string;
  vehicleLabel: string;
  driver: string;
  destination: string;
  pos: [number, number];
  status: string;
  moving: boolean;
};

type Props = {
  apiKey: string;
  demoMode: boolean;
  trips: FleetTripMarker[];
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
          toast.error(`Google Directions failed (${msg}). Using straight segments.`);
          onDemoPolyline(straightDemo);
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
      trips.forEach((t) => b.extend({ lat: t.pos[0], lng: t.pos[1] }));
      map.fitBounds(b, 48);
    }
  }, [demoMode, demoPolyline, trips]);

  const defaultCenter = demoMode ? DAVAO_CENTER : MANILA_CENTER;
  const pathLatLng = demoPolyline.map(([lat, lng]) => ({ lat, lng }));

  return (
    <GoogleMap
      mapContainerStyle={{ width: '100%', height: '100%' }}
      center={defaultCenter}
      zoom={demoMode ? 12 : 11}
      options={{
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

      {!demoMode &&
        trips.map((t) => (
          <Marker
            key={t.id}
            position={{ lat: t.pos[0], lng: t.pos[1] }}
            title={`${t.vehicleLabel} — ${t.driver}`}
            onClick={() => setFleetInfoId(t.id)}
            icon={{
              path: google.maps.SymbolPath.CIRCLE,
              scale: 10,
              fillColor: t.moving ? '#0f172a' : '#64748b',
              fillOpacity: 1,
              strokeColor: '#eab308',
              strokeWeight: 2,
            }}
          />
        ))}

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
                <div style={{ fontSize: 12, color: '#64748b' }}>Dest: {t.destination}</div>
                <div style={{ fontSize: 11, fontWeight: 700, marginTop: 4 }}>{t.status}</div>
              </div>
            </InfoWindow>
          );
        })()}
    </GoogleMap>
  );
}
