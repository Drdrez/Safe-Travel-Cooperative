import type { LatLng } from './routeGeometry';

export type DemoStop = { label: string; coords: LatLng };

/** Same sample itinerary as customer “Track My Trip” (Davao). Start = first pin, End = last. */
export const DAVAO_DEMO_STOPS: DemoStop[] = [
  { label: 'Start — Matina, Davao City', coords: [7.0485, 125.5678] },
  { label: 'Via — SM City Davao (Ecoland)', coords: [7.0563, 125.5855] },
  { label: 'Via — SM Lanang Premier', coords: [7.0983, 125.6324] },
  { label: 'End — Francisco Bangoy Airport (DVO)', coords: [7.1258, 125.6458] },
];
