import { useEffect, useRef } from 'react';
import { GoogleMap, Marker, Polyline, useJsApiLoader } from '@react-google-maps/api';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { fetchGoogleDrivingPath } from '../../lib/googleDirections';
import type { LatLng } from '../../lib/routeGeometry';

type RouteStop = { label: string; coords: LatLng };

/** Map opens on Davao City; all sample stops are in the metro area. */
const DAVAO_DEFAULT_CENTER = { lat: 7.0731, lng: 125.6131 };

const GOOGLE_ROUTE_BLUE = '#4285F4';
const GOOGLE_APPROACH_GREEN = '#137333';

type Props = {
  apiKey: string;
  tripStops: RouteStop[];
  stagingPoint: LatLng;
  pickup: LatLng;
  straightMain: LatLng[];
  straightArrival: LatLng[];
  mainPolyline: LatLng[];
  arrivalPolyline: LatLng[];
  currentPos: LatLng;
  simulationKind: 'trip' | 'arrival' | null;
  isSimulating: boolean;
  routeReloadNonce: number;
  vehicleLabel: string;
  onMainPolyline: (path: LatLng[]) => void;
  onArrivalPolyline: (path: LatLng[]) => void;
  onTripSourceGoogle: () => void;
  onTripSourceStraight: () => void;
  onRoutesLoading: (v: boolean) => void;
};

function truckIconUrl(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24"><rect width="24" height="24" rx="4" fill="#0f172a"/><path fill="#eab308" d="M6 14h12v2H6zm2-4h6v3H8zm9 1.5h2l1.5 2.5H17z"/><circle cx="8.5" cy="17" r="1.2" fill="#fff"/><circle cx="15.5" cy="17" r="1.2" fill="#fff"/></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export function GoogleCustomerTrackingMap(props: Props) {
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'customer-tracking-google-maps',
    googleMapsApiKey: props.apiKey,
    version: 'weekly',
  });

  if (loadError) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          color: 'var(--slate-600)',
          fontSize: 14,
          textAlign: 'center',
        }}
      >
        Google Maps failed to load. Set <code>VITE_GOOGLE_MAPS_API_KEY</code> and enable <strong>Maps JavaScript API</strong> and{' '}
        <strong>Directions API</strong> in Google Cloud Console.
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

  return <GoogleCustomerTrackingMapInner {...props} />;
}

function GoogleCustomerTrackingMapInner({
  tripStops,
  stagingPoint,
  pickup,
  straightMain,
  straightArrival,
  mainPolyline,
  arrivalPolyline,
  currentPos,
  simulationKind,
  isSimulating,
  routeReloadNonce,
  vehicleLabel,
  onMainPolyline,
  onArrivalPolyline,
  onTripSourceGoogle,
  onTripSourceStraight,
  onRoutesLoading,
}: Props) {
  const mapRef = useRef<google.maps.Map | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      onRoutesLoading(true);
      const mainWpts = tripStops.map((s) => s.coords);
      const arrivalWpts: LatLng[] = [stagingPoint, pickup];
      try {
        const [mainPath, arrPath] = await Promise.all([
          fetchGoogleDrivingPath(mainWpts),
          fetchGoogleDrivingPath(arrivalWpts),
        ]);
        if (cancelled) return;
        onMainPolyline(mainPath);
        onArrivalPolyline(arrPath);
        onTripSourceGoogle();
      } catch (e) {
        console.warn(e);
        toast.error('Google Directions could not build the route; using straight lines.');
        if (!cancelled) {
          onMainPolyline(straightMain);
          onArrivalPolyline(straightArrival);
          onTripSourceStraight();
        }
      } finally {
        if (!cancelled) onRoutesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    routeReloadNonce,
    tripStops,
    stagingPoint,
    pickup,
    straightMain,
    straightArrival,
    onMainPolyline,
    onArrivalPolyline,
    onTripSourceGoogle,
    onTripSourceStraight,
    onRoutesLoading,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || mainPolyline.length < 2) return;
    const b = new google.maps.LatLngBounds();
    mainPolyline.forEach(([lat, lng]) => b.extend({ lat, lng }));
    map.fitBounds(b, 56);
  }, [mainPolyline]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isSimulating) return;
    map.panTo({ lat: currentPos[0], lng: currentPos[1] });
  }, [currentPos, isSimulating]);

  const mainPathLatLng = mainPolyline.map(([lat, lng]) => ({ lat, lng }));
  const arrivalPathLatLng = arrivalPolyline.map(([lat, lng]) => ({ lat, lng }));
  const vehiclePos = { lat: currentPos[0], lng: currentPos[1] };

  return (
    <GoogleMap
      mapContainerStyle={{ width: '100%', height: '100%' }}
      center={DAVAO_DEFAULT_CENTER}
      zoom={12}
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
      {/* Google Maps–style solid blue driving line */}
      <Polyline
        path={mainPathLatLng}
        options={{
          strokeColor: GOOGLE_ROUTE_BLUE,
          strokeOpacity: simulationKind === 'arrival' ? 0.35 : 1,
          strokeWeight: 6,
        }}
      />
      {simulationKind === 'arrival' && (
        <Polyline
          path={arrivalPathLatLng}
          options={{
            strokeColor: GOOGLE_APPROACH_GREEN,
            strokeOpacity: 0.95,
            strokeWeight: 5,
          }}
        />
      )}

      {tripStops.map((stop, i) => {
        const isEnd = i === tripStops.length - 1;
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
        position={vehiclePos}
        title={vehicleLabel}
        icon={{
          url: truckIconUrl(),
          scaledSize: new google.maps.Size(40, 40),
          anchor: new google.maps.Point(20, 40),
        }}
      />
    </GoogleMap>
  );
}
