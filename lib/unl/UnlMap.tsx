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

class RecenterControl {
  private _container?: HTMLDivElement;
  private _button?: HTMLButtonElement;

  constructor(private getCenter: () => MapCenter | null, private zoom: number) {}

  onAdd(map: any) {
    this._container = document.createElement('div');
    this._container.className = 'maplibregl-ctrl maplibregl-ctrl-group';
    // Sit above the cell popup (z-index:3, see commit 8446552).
    this._container.style.zIndex = '4';

    const button = document.createElement('button');
    button.type = 'button';
    button.title = 'Center on my location';
    button.setAttribute('aria-label', 'Center on my location');
    button.className = 'maplibregl-ctrl-icon';
    button.style.display = 'flex';
    button.style.alignItems = 'center';
    button.style.justifyContent = 'center';
    button.style.cursor = 'pointer';
    button.innerHTML =
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '<path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>' +
      '</svg>';
    button.onclick = () => {
      const center = this.getCenter();
      if (!center) return;
      map.flyTo({ center, zoom: this.zoom });
    };

    this._container.appendChild(button);
    this._button = button;
    return this._container;
  }

  onRemove() {
    if (this._button) this._button.onclick = null;
    this._container?.parentNode?.removeChild(this._container);
    this._container = undefined;
    this._button = undefined;
  }
}

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
  // Always run geolocation: even when `focusOnUser` is false we want to cache the user's
  // location so the recenter button can fly the map back on demand.
  const { position, loading } = useGeolocation(true);

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
  const cachedCenterRef = useRef<MapCenter | null>(null);
  const userMarkerRef = useRef<any>(null);
  const [hasCachedCenter, setHasCachedCenter] = useState(false);

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
  }, [configured, mapId, mapCenter, zoomLevel, getFeatureCollectionOnClick, precision]);

  useEffect(() => {
    // Block init only when the caller explicitly wants the map centered on the user;
    // otherwise render immediately so unrelated forms aren't held up by geolocation.
    if (focusOnUser && isGeolocationLoading) return;
    initializeMap();
  }, [initializeMap, isGeolocationLoading, focusOnUser]);

  useEffect(() => {
    if (!position) return;
    if (!cachedCenterRef.current) {
      cachedCenterRef.current = [position.coords.longitude, position.coords.latitude];
      setHasCachedCenter(true);
    }
  }, [position]);

  // Drop a marker at the user's location once we have both a map and a position.
  useEffect(() => {
    if (!mapRef.current || !position || userMarkerRef.current) return;
    try {
      userMarkerRef.current = new UnlSdk.Marker()
        .setLngLat([position.coords.longitude, position.coords.latitude])
        .addTo(mapRef.current);
    } catch (err) {
      console.error('[unl] user marker add failed:', err);
    }
  }, [position, hasCachedCenter]);

  // Mount the recenter control once a location is cached. Hidden entirely otherwise.
  useEffect(() => {
    if (!mapRef.current || !hasCachedCenter) return;
    const ctrl = new RecenterControl(() => cachedCenterRef.current, zoomLevel);
    try {
      mapRef.current.addControl(ctrl, 'bottom-right');
    } catch (err) {
      console.error('[unl] recenter control add failed:', err);
      return;
    }
    return () => {
      try {
        mapRef.current?.removeControl?.(ctrl);
      } catch {
        /* map already destroyed */
      }
    };
  }, [hasCachedCenter, zoomLevel]);

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
        userMarkerRef.current = null;
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
        Map unavailable — UNL credentials are not configured. Set <code>NEXT_PUBLIC_UNL_MAP_API_KEY</code> and{' '}
        <code>NEXT_PUBLIC_UNL_MAP_VPM_ID</code> to enable location capture.
      </div>
    );
  }

  if (focusOnUser && isGeolocationLoading) {
    return (
      <div style={{ height: 360, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading map…</div>
    );
  }

  return (
    <div
      id={mapId}
      style={{
        width: '100%',
        height: 360,
        borderTopLeftRadius: 'var(--sjs-questionpanel-cornerRadius, 8px)',
        borderTopRightRadius: 'var(--sjs-questionpanel-cornerRadius, 8px)',
        // overflow: 'hidden',
      }}
    />
  );
}
