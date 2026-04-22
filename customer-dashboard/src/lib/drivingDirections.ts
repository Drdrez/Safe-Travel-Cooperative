import type { LatLng } from './routeGeometry';

export type DirectionsSource = 'mapbox' | 'osrm';

export type DrivingRouteResult = {
  coordinates: LatLng[];
  source: DirectionsSource;
};

function toLngLatCoordPair(p: LatLng): string {
  return `${p[1]},${p[0]}`;
}

function coordsPath(waypoints: LatLng[]): string {
  return waypoints.map(toLngLatCoordPair).join(';');
}

/** Positions as [lng, lat] (GeoJSON). */
function normalizeToLeaflet(coords: number[][]): LatLng[] {
  return coords.map(([lng, lat]) => [lat, lng] as LatLng);
}

function extractCoordinates(geometry: unknown): number[][] | null {
  if (!geometry) return null;
  if (Array.isArray(geometry)) return geometry as number[][];
  if (typeof geometry === 'object' && geometry !== null && 'coordinates' in geometry) {
    const c = (geometry as { coordinates?: number[][] }).coordinates;
    return Array.isArray(c) ? c : null;
  }
  return null;
}

async function fetchMapboxDirections(waypoints: LatLng[], accessToken: string): Promise<LatLng[]> {
  const path = coordsPath(waypoints);
  const url = new URL(
    `https://api.mapbox.com/directions/v5/mapbox/driving/${path}`,
  );
  url.searchParams.set('geometries', 'geojson');
  url.searchParams.set('overview', 'full');
  url.searchParams.set('access_token', accessToken.trim());

  const res = await fetch(url.toString());
  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText);
    throw new Error(`Mapbox Directions ${res.status}: ${errText.slice(0, 200)}`);
  }
  const data = (await res.json()) as { routes?: { geometry?: unknown }[] };
  const coords = extractCoordinates(data.routes?.[0]?.geometry);
  if (!coords?.length) throw new Error('Mapbox: no route geometry');
  return normalizeToLeaflet(coords);
}

async function fetchOsrmDirections(waypoints: LatLng[]): Promise<LatLng[]> {
  const path = coordsPath(waypoints);
  const url = `https://router.project-osrm.org/route/v1/driving/${path}?overview=full&geometries=geojson`;
  const res = await fetch(url);
  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText);
    throw new Error(`OSRM ${res.status}: ${errText.slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    routes?: { geometry?: unknown }[];
    code?: string;
  };
  if (data.code && data.code !== 'Ok') {
    throw new Error(`OSRM: ${data.code}`);
  }
  const coords = extractCoordinates(data.routes?.[0]?.geometry);
  if (!coords?.length) throw new Error('OSRM: no route geometry');
  return normalizeToLeaflet(coords);
}

/** Driving directions through all waypoints in order. Prefers Mapbox when `VITE_MAPBOX_ACCESS_TOKEN` is set. */
export async function fetchDrivingRoute(waypoints: LatLng[]): Promise<DrivingRouteResult> {
  if (waypoints.length < 2) {
    throw new Error('Need at least two waypoints');
  }

  const mapboxToken = (import.meta.env.VITE_MAPBOX_ACCESS_TOKEN as string | undefined)?.trim();
  if (mapboxToken) {
    const coordinates = await fetchMapboxDirections(waypoints, mapboxToken);
    return { coordinates, source: 'mapbox' };
  }

  const coordinates = await fetchOsrmDirections(waypoints);
  return { coordinates, source: 'osrm' };
}

export function straightLineFallback(waypoints: LatLng[]): LatLng[] {
  return [...waypoints];
}
