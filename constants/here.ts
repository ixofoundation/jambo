/**
 * HERE Maps configuration for the `map-grid-selector` SurveyJS question.
 * The key is client-side by design — restrict it via the domain allowlist on
 * platform.here.com. When unset, the map renders a stub notice instead
 * (see HereMap.tsx) and no HERE requests are made.
 */
export const getHereApiKey = (): string => process.env.NEXT_PUBLIC_HERE_API_KEY || '';

export const hasHereConfig = (): boolean => !!getHereApiKey();

/** Ready-made HERE vector style consumable directly by MapLibre GL. */
export const getHereVectorStyleUrl = (): string =>
  `https://assets.vector.hereapi.com/styles/berlin/base/mapbox/tilezen?apikey=${encodeURIComponent(getHereApiKey())}`;

/** Satellite raster tiles (HERE Raster Tile API v3) for the basemap toggle. */
export const getHereSatelliteTileUrl = (): string =>
  `https://maps.hereapi.com/v3/base/mc/{z}/{x}/{y}/jpeg?style=satellite.day&size=512&apiKey=${encodeURIComponent(
    getHereApiKey(),
  )}`;
