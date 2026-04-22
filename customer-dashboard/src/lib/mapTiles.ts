/**
 * Basemap configuration for Leaflet.
 *
 * For a richer map (recommended): set one of these in `.env`:
 * - VITE_MAPBOX_ACCESS_TOKEN — https://account.mapbox.com/access-tokens/
 * - VITE_MAPTILER_API_KEY — https://cloud.maptiler.com/account/keys/
 *
 * If neither is set, we fall back to CARTO Voyager (no key, OpenStreetMap data).
 */

export type MapTileLayerConfig = {
  url: string;
  attribution: string;
  /** Leaflet: use with 512 Mapbox raster tiles */
  tileSize?: number;
  zoomOffset?: number;
  subdomains?: string;
};

export type MapProviderId = 'mapbox' | 'maptiler' | 'carto';

export function getMapTileLayerConfig(): MapTileLayerConfig & { provider: MapProviderId } {
  const mapbox = (import.meta.env.VITE_MAPBOX_ACCESS_TOKEN as string | undefined)?.trim();
  const maptiler = (import.meta.env.VITE_MAPTILER_API_KEY as string | undefined)?.trim();

  if (mapbox) {
    const token = encodeURIComponent(mapbox);
    return {
      provider: 'mapbox',
      url: `https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/512/{z}/{x}/{y}?access_token=${token}`,
      attribution:
        '© <a href="https://www.mapbox.com/about/maps/">Mapbox</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      tileSize: 512,
      zoomOffset: -1,
    };
  }

  if (maptiler) {
    const key = encodeURIComponent(maptiler);
    return {
      provider: 'maptiler',
      url: `https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=${key}`,
      attribution:
        '<a href="https://www.maptiler.com/copyright/">MapTiler</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    };
  }

  return {
    provider: 'carto',
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    subdomains: 'abcd',
    attribution:
      '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/attributions">CARTO</a>',
  };
}
