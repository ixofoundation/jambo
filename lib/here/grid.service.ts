/**
 * Geohash grid math for the map-grid-selector question. The cell lattice is
 * standard geohash and the encoder below is plain geohash math (offline, no
 * vendor SDK) — verified byte-identical to `unl-core`'s encode across 100k+
 * samples incl. poles/antimeridian/cell boundaries.
 *
 * Note on stored geoId length: the old UNL implementation hardcoded encoding
 * at precision 8 regardless of the question's gridPrecision, so historical
 * claims store 8-char geoIds. Since the HERE migration the geoId is encoded
 * at the selected precision (deliberate fix) — consumers matching cells by
 * geoId across old and new claims must account for the length difference.
 */

/** Structural stand-in for maplibre's LngLat (only .lat/.lng are used). */
export interface LngLatLike {
  lng: number;
  lat: number;
}

export enum CellPrecision {
  GEOHASH_LENGTH_1 = 1,
  GEOHASH_LENGTH_2 = 2,
  GEOHASH_LENGTH_3 = 3,
  GEOHASH_LENGTH_4 = 4,
  GEOHASH_LENGTH_5 = 5,
  GEOHASH_LENGTH_6 = 6,
  GEOHASH_LENGTH_7 = 7,
  GEOHASH_LENGTH_8 = 8,
  GEOHASH_LENGTH_9 = 9,
  GEOHASH_LENGTH_10 = 10,
}

export interface Cell {
  locationId: string;
  size: string;
}

export const getFormattedCellDimensions = (cellPrecision: CellPrecision): string => {
  switch (+cellPrecision) {
    case CellPrecision.GEOHASH_LENGTH_1:
      return '5,009.4km x 4,992.6km';
    case CellPrecision.GEOHASH_LENGTH_2:
      return '1,252.3km x 624.1km';
    case CellPrecision.GEOHASH_LENGTH_3:
      return '156.5km x 156km';
    case CellPrecision.GEOHASH_LENGTH_4:
      return '39.1km x 19.5km';
    case CellPrecision.GEOHASH_LENGTH_5:
      return '4.9km x 4.9km';
    case CellPrecision.GEOHASH_LENGTH_6:
      return '1.2km x 609.4m';
    case CellPrecision.GEOHASH_LENGTH_7:
      return '152.9m x 152.4m';
    case CellPrecision.GEOHASH_LENGTH_8:
      return '38.2m x 19m';
    case CellPrecision.GEOHASH_LENGTH_9:
      return '4.8m x 4.8m';
    case CellPrecision.GEOHASH_LENGTH_10:
      return '1.2m x 59.5cm';
    default:
      return '4.8m x 4.8m';
  }
};

const GEOHASH_BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

/** Standard geohash encoding (binary subdivision, lon bit first). */
export const encodeGeohash = (lat: number, lon: number, precision: number): string => {
  let idx = 0;
  let bit = 0;
  let evenBit = true;
  let geohash = '';
  let latMin = -90;
  let latMax = 90;
  let lonMin = -180;
  let lonMax = 180;
  while (geohash.length < precision) {
    if (evenBit) {
      const mid = (lonMin + lonMax) / 2;
      if (lon >= mid) {
        idx = idx * 2 + 1;
        lonMin = mid;
      } else {
        idx = idx * 2;
        lonMax = mid;
      }
    } else {
      const mid = (latMin + latMax) / 2;
      if (lat >= mid) {
        idx = idx * 2 + 1;
        latMin = mid;
      } else {
        idx = idx * 2;
        latMax = mid;
      }
    }
    evenBit = !evenBit;
    if (++bit === 5) {
      geohash += GEOHASH_BASE32.charAt(idx);
      bit = 0;
      idx = 0;
    }
  }
  return geohash;
};

export const getCell = (coordinates: LngLatLike, cellPrecision: CellPrecision): Cell => {
  return {
    locationId: encodeGeohash(coordinates.lat, coordinates.lng, cellPrecision),
    size: getFormattedCellDimensions(cellPrecision),
  };
};

export const getCellPrecisionZoom = (cellPrecision: CellPrecision): number => {
  switch (+cellPrecision) {
    case CellPrecision.GEOHASH_LENGTH_1:
      return 2;
    case CellPrecision.GEOHASH_LENGTH_2:
      return 3;
    case CellPrecision.GEOHASH_LENGTH_3:
      return 4;
    case CellPrecision.GEOHASH_LENGTH_4:
      return 8;
    case CellPrecision.GEOHASH_LENGTH_5:
      return 10;
    case CellPrecision.GEOHASH_LENGTH_6:
      return 12;
    case CellPrecision.GEOHASH_LENGTH_7:
      return 14;
    case CellPrecision.GEOHASH_LENGTH_8:
      return 16;
    case CellPrecision.GEOHASH_LENGTH_9:
      return 18;
    case CellPrecision.GEOHASH_LENGTH_10:
      return 20;
    default:
      return 18;
  }
};

/**
 * Lon/lat degree spans of a geohash cell at a precision. Each geohash char is
 * 5 bits, alternating lon/lat starting with lon — so lon gets the extra bit at
 * odd precisions. Cells form a fixed lattice anchored at (-180, -90).
 */
export const getCellSpans = (cellPrecision: CellPrecision): { lonSpan: number; latSpan: number } => {
  const bits = 5 * cellPrecision;
  const lonBits = Math.ceil(bits / 2);
  const latBits = Math.floor(bits / 2);
  return { lonSpan: 360 / 2 ** lonBits, latSpan: 180 / 2 ** latBits };
};

/** Bounds of the geohash cell containing a point (pure lattice math). */
export const getCellBounds = (
  lat: number,
  lng: number,
  cellPrecision: CellPrecision,
): { west: number; south: number; east: number; north: number } => {
  const { lonSpan, latSpan } = getCellSpans(cellPrecision);
  const west = Math.floor(lng / lonSpan) * lonSpan;
  const south = Math.floor(lat / latSpan) * latSpan;
  return { west, south, east: west + lonSpan, north: south + latSpan };
};
