import type { LatLng } from './routeGeometry';

/** Google Maps-style driving polyline (requires Maps JavaScript API loaded). */
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
      },
      (result, status) => {
        if (status !== 'OK' || !result?.routes[0]?.overview_path) {
          reject(new Error(status === 'OK' ? 'No route path' : String(status)));
          return;
        }
        const path = result.routes[0].overview_path
          .getArray()
          .map((ll) => [ll.lat(), ll.lng()] as LatLng);
        resolve(path);
      },
    );
  });
}
