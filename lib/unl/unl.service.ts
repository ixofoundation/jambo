import type { LngLat } from 'maplibre-gl';
import UnlCore from 'unl-core';

import { getUNLMapApiKey, getUNLMapVpmId, hasUNLConfig } from '@constants/unl';

const BASE_URL = 'https://api.unl.global/v3';

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

export const getCell = (coordinates: LngLat, cellPrecision: CellPrecision): Cell => ({
  locationId: UnlCore.encode(coordinates.lat, coordinates.lng, cellPrecision),
  size: getFormattedCellDimensions(cellPrecision),
});

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
 * Returns null when UNL credentials are not configured — caller should fall back
 * to building a minimal feature from raw lat/lng/geoId.
 */
export const geocodeReverseWithGeoId = async (geoId: string): Promise<any | null> => {
  if (!hasUNLConfig()) return null;

  const params = new URLSearchParams({
    location: JSON.stringify({ Cell: geoId }),
  });

  const response = await fetch(`${BASE_URL}/geocode/reverse?${params.toString()}`, {
    headers: {
      'x-unl-api-key': getUNLMapApiKey(),
      'x-unl-vpm-id': getUNLMapVpmId(),
    },
  });

  if (!response.ok) {
    throw new Error(`UNL API request failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
};

export const geocodeReverseWithPoint = async (point: LngLat): Promise<any | null> => {
  if (!hasUNLConfig()) return null;

  const params = new URLSearchParams({
    location: JSON.stringify({ Point: point.toArray() }),
  });

  const response = await fetch(`${BASE_URL}/geocode/reverse?${params.toString()}`, {
    headers: {
      'x-unl-api-key': getUNLMapApiKey(),
      'x-unl-vpm-id': getUNLMapVpmId(),
    },
  });

  if (!response.ok) {
    throw new Error(`UNL API request failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
};

/**
 * Builds a minimal GeoJSON-style feature collection from a clicked point + its UNL
 * geohash, used when reverse-geocoding is unavailable (no API keys configured).
 */
export const buildFallbackFeatureCollection = (lng: number, lat: number, geoId: string) => ({
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [lng, lat] },
      properties: {
        unl_location: { id: geoId },
        postal_address: [{}],
        place: {},
      },
    },
  ],
});
