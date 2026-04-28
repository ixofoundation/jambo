import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import type { LngLat } from 'maplibre-gl';
// `unl-map-js` reaches for `window` at module load. This file is only ever loaded
// via `UnlMapClient` (next/dynamic, ssr:false), so the side-effects stay client-only.
import UnlSdk from 'unl-map-js';

import { getUNLMapApiKey, getUNLMapVpmId, hasUNLConfig } from '@constants/unl';
import {
  CellPrecision,
  buildFallbackFeatureCollection,
  geocodeReverseWithGeoId,
  getCell,
  getCellPrecisionZoom,
} from './unl.service';

const MAP_HTML_ELEMENT_ID = 'unl-map';
const DEFAULT_CENTER: [number, number] = [0, 0];
const GEOLOCATION_TIMEOUT = 10000;
const GEOLOCATION_MAX_AGE = 600000; // 10 minutes

type Feature = {
  type: 'Feature';
  geometry: { type: 'Point'; coordinates: [number, number] };
  properties: Record<string, any>;
};
type FeatureCollection = { type: 'FeatureCollection'; features: Feature[] };
type MapCenter = [number, number];

interface Props {
  latitude?: string | number;
  longitude?: string | number;
  mapId?: string;
  zoom?: number;
  center?: [number, number] | `${number},${number}`;
  precision: CellPrecision;
  getFeatureCollectionOnClick?: (featureCollection: FeatureCollection) => void;
  focusOnUser?: boolean;
}

function useGeolocation(enabled: boolean) {
  const [position, setPosition] = useState<GeolocationPosition | undefined>(undefined);
  const [error, setError] = useState<GeolocationPositionError | undefined>(undefined);
  const [loading, setLoading] = useState(enabled);

  useEffect(() => {
    if (!enabled || typeof navigator === 'undefined' || !navigator.geolocation) {
      setLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPosition(pos);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      },
      { timeout: GEOLOCATION_TIMEOUT, enableHighAccuracy: false, maximumAge: GEOLOCATION_MAX_AGE },
    );
  }, [enabled]);

  return { position, error, loading };
}

function useMapCenter(props: Pick<Props, 'latitude' | 'longitude' | 'center' | 'focusOnUser'>) {
  const { latitude, longitude, center, focusOnUser } = props;
  const { position, loading } = useGeolocation(focusOnUser || false);

  const mapCenter: MapCenter = useMemo(() => {
    if (focusOnUser && position) {
      return [position.coords.longitude, position.coords.latitude];
    }
    if (center) {
      if (typeof center === 'string') return center.split(',').map(Number) as MapCenter;
      if (Array.isArray(center) && center.length === 2) return [Number(center[0]), Number(center[1])] as MapCenter;
    }
    if (latitude !== undefined && longitude !== undefined) {
      return [Number(longitude), Number(latitude)];
    }
    return DEFAULT_CENTER;
  }, [center, latitude, longitude, focusOnUser, position]);

  return { mapCenter, isGeolocationLoading: loading, position };
}

export default function UnlMap({
  latitude,
  longitude,
  mapId = MAP_HTML_ELEMENT_ID,
  center,
  precision,
  getFeatureCollectionOnClick,
  focusOnUser = false,
}: Props) {
  const configured = hasUNLConfig();
  const zoomLevel = getCellPrecisionZoom(precision);
  const { mapCenter, isGeolocationLoading, position } = useMapCenter({ latitude, longitude, center, focusOnUser });
  const mapRef = useRef<any>(null);
  const isInitializedRef = useRef(false);

  const initializeMap = useCallback(() => {
    if (!configured) return;
    const element = typeof document !== 'undefined' ? document.getElementById(mapId) : null;
    if (!element) return;
    if (isInitializedRef.current || element.children.length > 0) return;

    try {
      const map = new UnlSdk.Map({
        container: mapId,
        apiKey: getUNLMapApiKey(),
        vpmId: getUNLMapVpmId(),
        center: mapCenter,
        gridControl: true,
        zoom: zoomLevel,
        tilesSelectorControl: true,
      });

      if (position) {
        new UnlSdk.Marker()
          .setLngLat([position.coords.longitude, position.coords.latitude])
          .addTo(map);
      }

      if (getFeatureCollectionOnClick && precision) {
        map.on('click', async (e: any) => {
          try {
            const lngLat = e.lngLat as LngLat;
            const cell = getCell(lngLat, 8);
            const fc = await geocodeReverseWithGeoId(cell.locationId);
            if (fc) {
              getFeatureCollectionOnClick(fc);
            } else {
              // Reverse-geocode unavailable — emit a minimal feature so the cell is still selectable.
              getFeatureCollectionOnClick(
                buildFallbackFeatureCollection(lngLat.lng, lngLat.lat, cell.locationId) as unknown as FeatureCollection,
              );
            }
          } catch (err) {
            console.error('[unl] map click handler failed:', err);
          }
        });
      }

      mapRef.current = map;
      isInitializedRef.current = true;
    } catch (err) {
      console.error('[unl] map init failed:', err);
    }
  }, [configured, mapId, mapCenter, zoomLevel, getFeatureCollectionOnClick, precision, position]);

  useEffect(() => {
    if (!isGeolocationLoading) initializeMap();
  }, [initializeMap, isGeolocationLoading]);

  useEffect(
    () => () => {
      if (mapRef.current) {
        try {
          mapRef.current.remove?.();
        } catch {
          /* ignore */
        }
        mapRef.current = null;
        isInitializedRef.current = false;
      }
    },
    [],
  );

  if (!configured) {
    return (
      <div
        style={{
          height: 160,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '12px 16px',
          textAlign: 'center',
          fontSize: 13,
          color: 'var(--sjs-general-forecolor-light, var(--text-primary, #555))',
          background: 'var(--sjs-general-backcolor-dim-light, var(--bg-secondary, #f4f4f4))',
          borderRadius: 8,
        }}
      >
        Map unavailable — UNL credentials are not configured. Set <code>NEXT_PUBLIC_UNL_MAP_API_KEY</code>{' '}
        and <code>NEXT_PUBLIC_UNL_MAP_VPM_ID</code> to enable location capture.
      </div>
    );
  }

  if (isGeolocationLoading) {
    return (
      <div style={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        Loading map…
      </div>
    );
  }

  return <div id={mapId} style={{ width: '100%', height: 280 }} />;
}
