/** Photon (Komoot) — browser-friendly geocoding, no API key. Bias toward Philippines. */
const PH_BBOX = '118.0,4.5,127.5,21.5';

export type GeocodeResult = { lat: number; lng: number };

export async function geocodeAddress(query: string): Promise<GeocodeResult | null> {
  const q = query.trim();
  if (!q) return null;
  const url = new URL('https://photon.komoot.io/api/');
  url.searchParams.set('q', q);
  url.searchParams.set('limit', '1');
  url.searchParams.set('lang', 'en');
  url.searchParams.set('bbox', PH_BBOX);

  const res = await fetch(url.toString());
  if (!res.ok) return null;
  const data = (await res.json()) as { features?: Array<{ geometry?: { coordinates?: number[] } }> };
  const c = data?.features?.[0]?.geometry?.coordinates;
  if (!Array.isArray(c) || c.length < 2) return null;
  const lng = Number(c[0]);
  const lat = Number(c[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}
