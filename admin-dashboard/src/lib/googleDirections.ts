import type { LatLng } from './routeGeometry';

/** Handles LatLng instances, LatLngLiteral, and mixed arrays from Directions overview_path. */
function toLatLngTuple(p: google.maps.LatLng | google.maps.LatLngLiteral): LatLng {
  if (typeof (p as google.maps.LatLng).lat === 'function') {
    const ll = p as google.maps.LatLng;
    return [ll.lat(), ll.lng()];
  }
  const lit = p as google.maps.LatLngLiteral;
  return [lit.lat, lit.lng];
}

function overviewPathToTuples(
  overview: google.maps.LatLng[] | google.maps.MVCArray<google.maps.LatLng>,
): LatLng[] {
  const pts: Array<google.maps.LatLng | google.maps.LatLngLiteral> = Array.isArray(overview)
    ? overview
    : overview.getArray();
  return pts.map(toLatLngTuple);
}

export async function fetchGoogleDrivingPath(waypoints: LatLng[]): Promise<LatLng[]> {
  if (typeof google === 'undefined' || !google.maps) {
    throw new Error('Google Maps API not loaded');
  }
  if (waypoints.length < 2) {
    throw new Error('Need at least two waypoints');
  }

  const origin = { lat: waypoints[0][0], lng: waypoints[0][1] };
  const destination = { lat: waypoints[waypoints.length - 1][0], lng: waypoints[waypoints.length - 1][1] };
  const waypts =
    waypoints.length > 2
      ? waypoints.slice(1, -1).map((w) => ({
          location: { lat: w[0], lng: w[1] },
          stopover: true,
        }))
      : undefined;

  const svc = new google.maps.DirectionsService();

  return new Promise((resolve, reject) => {
    svc.route(
      {
        origin,
        destination,
        waypoints: waypts,
        travelMode: google.maps.TravelMode.DRIVING,
        optimizeWaypoints: false,
        region: 'ph',
      },
      (result, status) => {
        const overview = result?.routes[0]?.overview_path;
        if (status !== 'OK' || !overview) {
          reject(new Error(status === 'OK' ? 'No route path' : String(status)));
          return;
        }
        try {
          resolve(overviewPathToTuples(overview as google.maps.LatLng[] | google.maps.MVCArray<google.maps.LatLng>));
        } catch (e) {
          reject(e instanceof Error ? e : new Error(String(e)));
        }
      },
    );
  });
}
