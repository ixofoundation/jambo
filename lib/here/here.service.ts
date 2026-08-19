/**
 * HERE reverse geocoding for the map-grid-selector question. Replaces the UNL
 * `/v3/geocode/reverse` call; the HERE Geocoding & Search v7 response is
 * adapted to the same FeatureCollection shape (`properties.place` +
 * `properties.postal_address[0]`) that `createGridCellData` in
 * MapGridSelector.tsx already consumes, so the stored answer format is
 * unchanged by the migration. HERE returns ISO alpha-3 country codes — they
 * are mapped back to the alpha-2 codes the UNL implementation emitted.
 */
import { getHereApiKey, hasHereConfig } from '@constants/here';
import { toAlpha2CountryCode } from './countryCodes';

const REVGEOCODE_URL = 'https://revgeocode.search.hereapi.com/v1/revgeocode';

/** GeoJSON-ish shapes shared with the map + widget (map-vendor agnostic). */
export type Feature = {
  type: 'Feature';
  geometry: { type: 'Point'; coordinates: [number, number] };
  properties: Record<string, unknown>;
};

export type FeatureCollection = {
  type: 'FeatureCollection';
  features: Feature[];
};

type HereAddress = {
  label?: string;
  countryCode?: string;
  countryName?: string;
  stateCode?: string;
  state?: string;
  countyCode?: string;
  county?: string;
  city?: string;
  district?: string;
  subdistrict?: string;
  block?: string;
  subblock?: string;
  street?: string;
  postalCode?: string;
  houseNumber?: string;
  building?: string;
};

type HereItem = {
  id?: string;
  title?: string;
  distance?: number;
  position?: { lat: number; lng: number };
  address?: HereAddress;
};

/** Only include nested objects that actually carry data (mirrors how the UNL
 * response omitted empty levels — the widget guards each field anyway). */
const compact = <T extends Record<string, unknown>>(obj: T): T | undefined => {
  const entries = Object.entries(obj).filter(([, v]) => v !== undefined && v !== null && v !== '');
  if (entries.length === 0) return undefined;
  return Object.fromEntries(entries) as T;
};

const toFeatureCollection = (item: HereItem | undefined, lng: number, lat: number): FeatureCollection => {
  if (!item) return { type: 'FeatureCollection', features: [] };
  const a = item.address ?? {};

  const place = compact({
    identifier: item.id,
    name: item.title,
    // GridCell.placeDistance is a string (UNL convention) — meters from the
    // tapped point to the matched address/place.
    distance: typeof item.distance === 'number' ? String(item.distance) : undefined,
  });

  const postalAddress = compact({
    name: a.label,
    country: compact({
      country_code: a.countryCode ? toAlpha2CountryCode(a.countryCode) : undefined,
      name: a.countryName,
    }),
    state: compact({ state_code: a.stateCode, name: a.state }),
    county: compact({ county_code: a.countyCode, name: a.county }),
    city: compact({ name: a.city }),
    district: compact({ name: a.district }),
    sub_district: compact({ name: a.subdistrict }),
    block: compact({ name: a.block }),
    sub_block: compact({ name: a.subblock }),
    // HERE has no separate road-type field; `type` is intentionally absent.
    road: compact({ name: a.street }),
    postal_code: a.postalCode,
    // Closest HERE analogue of UNL's house name is the building name.
    house: compact({ name: a.building, number: a.houseNumber }),
  });

  const position = item.position ?? { lat, lng };
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [position.lng, position.lat],
        },
        properties: compact({ place, postal_address: postalAddress ? [postalAddress] : undefined }) ?? {},
      },
    ],
  };
};

/** Reverse geocode a point; resolves to the widget's FeatureCollection shape.
 * Callers must not attach the coordinates to any Sentry report (user PII). */
export const reverseGeocode = async (lat: number, lng: number): Promise<FeatureCollection> => {
  // No key configured — skip the network call; the local geohash cell is
  // authoritative, so selection still works without address details.
  if (!hasHereConfig()) return { type: 'FeatureCollection', features: [] };
  const params = new URLSearchParams({
    at: `${lat},${lng}`,
    lang: 'en-US',
    apiKey: getHereApiKey(),
  });
  const response = await fetch(`${REVGEOCODE_URL}?${params}`);
  if (!response.ok) {
    throw new Error(`HERE revgeocode request failed: ${response.status} ${response.statusText}`);
  }
  const data = (await response.json()) as { items?: HereItem[] };
  return toFeatureCollection(data.items?.[0], lng, lat);
};
