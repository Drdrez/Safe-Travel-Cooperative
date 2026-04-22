/** Photon (Komoot) — browser-friendly geocoding, no API key. Bias toward Philippines. */
const PH_BBOX = '118.0,4.5,127.5,21.5';

export type GeocodeResult = { lat: number; lng: number };

type PhotonFeature = {
  geometry?: { coordinates?: number[] };
  properties?: { name?: string; country?: string; state?: string; type?: string };
};

function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/** Prefer these full queries when Photon returns the wrong sibling city (e.g. Tandag → Butuan). */
function disambiguationQueries(raw: string): string[] {
  const q = raw.trim();
  if (!q) return [];
  const lower = q.toLowerCase();
  const hints: string[] = [];
  if (/\btandag\b/i.test(lower)) {
    hints.push('Tandag City, Surigao del Sur, Philippines');
    hints.push('Tandag, Surigao del Sur, Philippines');
  }
  if (/\bbutuan\b/i.test(lower)) hints.push('Butuan City, Agusan del Norte, Philippines');
  if (/\bsurigao\s*city\b/i.test(lower)) hints.push('Surigao City, Surigao del Norte, Philippines');
  if (/\bdavao\s*city\b/i.test(lower) || /^davao$/i.test(lower)) {
    hints.push('Davao City, Davao del Sur, Philippines');
  }
  if (/\bcagayan\s*de\s*oro\b/i.test(lower)) hints.push('Cagayan de Oro, Misamis Oriental, Philippines');
  if (/\bgeneral\s*santos\b/i.test(lower)) hints.push('General Santos City, South Cotabato, Philippines');
  return hints;
}

async function photonSearch(query: string, limit: number): Promise<PhotonFeature[]> {
  const url = new URL('https://photon.komoot.io/api/');
  url.searchParams.set('q', query);
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('lang', 'en');
  url.searchParams.set('bbox', PH_BBOX);

  const res = await fetch(url.toString());
  if (!res.ok) return [];
  const data = (await res.json()) as { features?: PhotonFeature[] };
  return data?.features ?? [];
}

function featureToResult(f: PhotonFeature): GeocodeResult | null {
  const c = f.geometry?.coordinates;
  if (!Array.isArray(c) || c.length < 2) return null;
  const lng = Number(c[0]);
  const lat = Number(c[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

/** Pick best feature when multiple: prefer Philippines + name contains a token from the original query. */
function pickBestFeature(features: PhotonFeature[], originalQuery: string): GeocodeResult | null {
  const tokens = originalQuery
    .toLowerCase()
    .split(/[\s,]+/)
    .filter((t) => t.length > 2);
  let best: { score: number; r: GeocodeResult } | null = null;
  for (const f of features) {
    const r = featureToResult(f);
    if (!r) continue;
    const props = f.properties ?? {};
    const name = (props.name ?? '').toLowerCase();
    const country = (props.country ?? '').toLowerCase();
    let score = country.includes('philippines') || country === '' ? 2 : 0;
    for (const tok of tokens) {
      if (tok && name.includes(tok)) score += 3;
    }
    if (props.type === 'city' || props.type === 'town' || props.type === 'village') score += 1;
    if (!best || score > best.score) best = { score, r };
  }
  return best?.r ?? featureToResult(features[0] ?? {});
}

/**
 * Geocode a place name in the Philippines. Tries disambiguated queries first to avoid wrong cities.
 */
export async function geocodeAddress(query: string): Promise<GeocodeResult | null> {
  const q = query.trim();
  if (!q) return null;

  const attempts = [
    ...disambiguationQueries(q),
    `${q}, Philippines`,
    `${q}, Mindanao, Philippines`,
    q,
  ];
  const tried = new Set<string>();
  for (const aq of attempts) {
    const key = aq.toLowerCase();
    if (tried.has(key)) continue;
    tried.add(key);
    const features = await photonSearch(aq, 6);
    if (!features.length) continue;
    const picked = pickBestFeature(features, q) ?? featureToResult(features[0]);
    if (picked) return picked;
  }
  return null;
}

/** Known reference center for Tandag City (for validating bad stored coordinates). */
export const TANDAG_CITY_REF: GeocodeResult = { lat: 9.0783, lng: 126.1986 };
export const BUTUAN_CITY_REF: GeocodeResult = { lat: 8.9475, lng: 125.5436 };

/**
 * If the user typed "Tandag" but stored coords are closer to Butuan (common Photon error), return true.
 */
export function destinationLooksMisplacedForTandag(destinationText: string, lat: number, lng: number): boolean {
  if (!/\btandag\b/i.test(destinationText.trim())) return false;
  const p = { lat, lng };
  const dTandag = haversineMeters(p, TANDAG_CITY_REF);
  const dButuan = haversineMeters(p, BUTUAN_CITY_REF);
  return dButuan < 45000 && dButuan < dTandag * 0.9;
}
