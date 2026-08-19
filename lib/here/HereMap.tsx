/**
 * HERE-based map for the map-grid-selector question — replaces the UNL SDK
 * wrapper (UnlMap) with maplibre-gl driving HERE vector tiles directly.
 * Ported from supamoto-inventory-web-app. Behavior parity with the UNL
 * version: grid overlay at the question's precision, live "Choose grid size"
 * changes, vector ⇄ satellite basemap toggle, display mode centered on the
 * saved cell, a single marker that follows the latest click, recenter button,
 * pulsing "you are here" dot, and a visible map-error state.
 * Differences from the UNL implementation:
 * - the geohash grid + precision picker + basemap toggle are drawn/owned here
 *   (HERE has no grid control) — see mapControls.ts and grid.service.ts;
 * - selected cell(s) are highlighted on the grid (the UNL SDK only showed the
 *   marker), including saved answers in display mode;
 * - reverse geocoding goes through HERE Geocoding & Search v7 (here.service
 *   adapts the response to the UNL shape the widget consumes);
 * - teardown is plain maplibre `map.remove()` — the UNL SDK's teardown-race
 *   workarounds are gone.
 * Kept from the UNL version: the `center` prop accepts the template's
 * "lat, lng" string form (swapped via the |lat| ≤ 90 heuristic), map CSS is
 * bundled via imports, the container is reclaimed on re-mount (StrictMode),
 * and the recenter button never re-requests the location or moves the marker.
 */
// maplibre-gl CSS is imported globally in pages/_app.tsx (pages router).
import React, { useCallback, useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import { getHereSatelliteTileUrl, getHereVectorStyleUrl, hasHereConfig } from '@constants/here';
import { CellPrecision, getCell, getCellBounds, getCellPrecisionZoom, getCellSpans } from './grid.service';
import { reverseGeocode, type Feature, type FeatureCollection } from './here.service';
import { BasemapToggleControl, GridSizeControl } from './mapControls';

export type { Feature, FeatureCollection };

const errMsg = (e: unknown, fallback: string): string => (e instanceof Error && e.message ? e.message : fallback);

const MAP_HTML_ELEMENT_ID = 'here-map';
const DEFAULT_CENTER: [number, number] = [0, 0];
const GEOLOCATION_TIMEOUT = 10000;
const GEOLOCATION_MAX_AGE = 600000; // 10 minutes

// Grid/selection layer ids + colors. Map-chrome literals on purpose (drawn on
// third-party basemaps, not app surfaces): neutral dark lines on the vector
// style, white on satellite imagery, blue for the selected cell highlight.
const GRID_SOURCE = 'geohash-grid';
const GRID_LAYER = 'geohash-grid-lines';
const SELECTION_SOURCE = 'geohash-selection';
const SELECTION_FILL_LAYER = 'geohash-selection-fill';
const SELECTION_OUTLINE_LAYER = 'geohash-selection-outline';
const SATELLITE_SOURCE = 'here-satellite';
const SATELLITE_LAYER = 'here-satellite-layer';
const GRID_COLOR_VECTOR = 'rgba(70, 70, 70, 0.4)';
const GRID_COLOR_SATELLITE = 'rgba(255, 255, 255, 0.55)';
const SELECTION_COLOR = '#1a73e8';
/** Above this many lattice lines per axis the grid is hidden — the viewport
 * is too zoomed-out for the precision to be readable (mirrors the UNL grid,
 * which only rendered near its precision's zoom). */
const MAX_GRID_LINES = 200;

const EMPTY_FC = {
  type: 'FeatureCollection',
  features: [],
} as unknown as GeoJSON.FeatureCollection;

/** HERE's OMV vector endpoint serves tiles up to z17 ONLY — deeper zooms 400.
 * The camera still goes deeper (precision 9 opens at z18); capping the SOURCE
 * makes maplibre overzoom (scale) the z17 tiles instead of requesting them. */
const VECTOR_TILE_MAX_ZOOM = 17;
/** Raster Tile API v3 serves satellite up to z20. */
const SATELLITE_TILE_MAX_ZOOM = 20;

// Style JSON cache — one fetch per session (the URL embeds the api key).
let cachedStyle: Promise<Record<string, unknown>> | null = null;

/**
 * Fetch HERE's hosted style and cap its vector sources at z17. The hosted
 * style declares its `tiles` array without a maxzoom, so maplibre's default
 * (22) would request z18+ tiles the endpoint rejects — the map would error
 * out instantly at house-level precision.
 */
const getPatchedHereStyle = (): Promise<Record<string, unknown>> => {
  if (!cachedStyle) {
    cachedStyle = (async () => {
      const response = await fetch(getHereVectorStyleUrl());
      if (!response.ok) {
        throw new Error(`HERE style request failed: ${response.status} ${response.statusText}`);
      }
      const style = (await response.json()) as {
        sources?: Record<string, { type?: string; maxzoom?: number }>;
      };
      for (const source of Object.values(style.sources ?? {})) {
        if (source.type === 'vector') {
          source.maxzoom = Math.min(source.maxzoom ?? VECTOR_TILE_MAX_ZOOM, VECTOR_TILE_MAX_ZOOM);
        }
      }
      return style as Record<string, unknown>;
    })();
    // Allow a retry on the next mount instead of caching the failure.
    cachedStyle.catch(() => {
      cachedStyle = null;
    });
  }
  return cachedStyle;
};

/** The locally-computed cell for a click — always available, even offline. */
export type ClickedCell = {
  locationId: string;
  coordinates: [number, number]; // [lng, lat]
};

type MapCenter = [number, number];

/** Minimal shape of a stored answer cell the map needs (avoids a circular
 * import of the full GridCell type from MapGridSelector). */
type CellValueLike = {
  latitude: number;
  longitude: number;
  gridPrecision?: CellPrecision;
};
type ValueLike = CellValueLike | CellValueLike[] | null | undefined;

interface Props {
  mapId?: string;
  /** Current question value — centers the map in display mode, seeds the grid
   * precision from an existing answer, and drives the cell highlight. */
  value?: ValueLike;
  /** Read-only rendering: center/marker on the saved cell, no click handler. */
  displayMode?: boolean;
  /** "lat, lng" string (template convention) or [lng, lat] array (GeoJSON). */
  center?: string | [number, number];
  gridPrecision?: CellPrecision;
  minZoom?: number;
  maxZoom?: number;
  focusOnUser?: boolean;
  /** Show the vector ⇄ satellite toggle (question's `basemapToggle`). */
  basemapToggle?: boolean;
  getFeatureCollectionOnClick?: (
    featureCollection: FeatureCollection | null,
    cellInfo: ClickedCell,
    precision: CellPrecision,
  ) => void;
}

/**
 * Normalize the question's center to [lng, lat]. Strings follow the template
 * convention "lat, lng"; the |first| ≤ 90 heuristic guards against authors
 * who already wrote "lng, lat" (longitudes beyond ±90 are unambiguous).
 */
function normalizeCenter(c?: string | [number, number]): MapCenter | undefined {
  if (!c) return undefined;
  if (Array.isArray(c)) return c;
  const [a, b] = c.split(',').map((s) => Number(s.trim()));
  if (!Number.isFinite(a) || !Number.isFinite(b)) return undefined;
  return Math.abs(a) > 90 ? [a, b] : [b, a];
}

function firstCell(value: ValueLike): CellValueLike | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

/** Geohash lattice lines covering the current viewport (empty when the cells
 * would be too small to read at this zoom). Known limitation (shared with the
 * supamoto implementation): viewports wrapped across the antimeridian clamp
 * to [-180, 180], so the grid overlay thins or disappears there — clicks
 * still select correctly via the wrapped-longitude path. */
function buildGridData(map: maplibregl.Map, precision: CellPrecision): GeoJSON.FeatureCollection {
  const bounds = map.getBounds();
  const west = Math.max(bounds.getWest(), -180);
  const east = Math.min(bounds.getEast(), 180);
  const south = Math.max(bounds.getSouth(), -85);
  const north = Math.min(bounds.getNorth(), 85);
  const { lonSpan, latSpan } = getCellSpans(precision);
  if ((east - west) / lonSpan > MAX_GRID_LINES || (north - south) / latSpan > MAX_GRID_LINES) {
    return EMPTY_FC;
  }
  const lines: [number, number][][] = [];
  for (let lng = Math.floor(west / lonSpan) * lonSpan; lng <= east; lng += lonSpan) {
    lines.push([
      [lng, south],
      [lng, north],
    ]);
  }
  for (let lat = Math.floor(south / latSpan) * latSpan; lat <= north; lat += latSpan) {
    lines.push([
      [west, lat],
      [east, lat],
    ]);
  }
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: { type: 'MultiLineString', coordinates: lines },
        properties: {},
      },
    ],
  } as unknown as GeoJSON.FeatureCollection;
}

/** Polygons for the selected cell(s), each at the precision it was captured
 * with (a saved answer re-renders on the grid it was captured on). */
function buildSelectionData(value: ValueLike, fallbackPrecision: CellPrecision): GeoJSON.FeatureCollection {
  const cells = !value ? [] : Array.isArray(value) ? value : [value];
  return {
    type: 'FeatureCollection',
    features: cells.map((cell) => {
      const { west, south, east, north } = getCellBounds(
        cell.latitude,
        cell.longitude,
        cell.gridPrecision ?? fallbackPrecision,
      );
      return {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [west, south],
              [east, south],
              [east, north],
              [west, north],
              [west, south],
            ],
          ],
        },
        properties: {},
      };
    }),
  } as unknown as GeoJSON.FeatureCollection;
}

function useGeolocation(enabled: boolean) {
  const [position, setPosition] = React.useState<GeolocationPosition | undefined>(undefined);
  const [loading, setLoading] = React.useState(enabled);

  useEffect(() => {
    if (!enabled || !navigator.geolocation) {
      setLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPosition(pos);
        setLoading(false);
      },
      (err) => {
        console.warn('Geolocation denied or failed:', err.message);
        setLoading(false);
      },
      {
        timeout: GEOLOCATION_TIMEOUT,
        enableHighAccuracy: false,
        maximumAge: GEOLOCATION_MAX_AGE,
      },
    );
  }, [enabled]);

  return { position, loading };
}

function useMapCenter(
  center: string | [number, number] | undefined,
  focusOnUser: boolean,
  value: ValueLike,
  displayMode: boolean,
  geolocationEnabled: boolean,
) {
  // Geolocation runs whenever the map is interactive (parity with the old
  // UnlMap): the "you are here" dot and recenter button work even when
  // focusOnUser is off — focusOnUser only decides the initial center.
  const { position, loading } = useGeolocation(geolocationEnabled);

  // Depend on the display cell's coordinates, not the value's object identity:
  // every tap produces a new value object, and an identity dep would re-fire
  // the marker-follow effect with the SAME center — snapping the marker away
  // from the tapped point right after the click handler placed it.
  const displayCell = displayMode ? firstCell(value) : undefined;
  const cellLng = displayCell?.longitude;
  const cellLat = displayCell?.latitude;

  const mapCenter: MapCenter = React.useMemo(() => {
    if (cellLng !== undefined && cellLat !== undefined) {
      return [cellLng, cellLat];
    }
    if (focusOnUser && position) {
      return [position.coords.longitude, position.coords.latitude];
    }
    return normalizeCenter(center) ?? DEFAULT_CENTER;
  }, [center, focusOnUser, position, cellLng, cellLat]);

  return { mapCenter, position, isGeolocationLoading: loading };
}

function useMapInstance(options: {
  mapId: string;
  /** Pre-fetched, zoom-capped HERE style — init waits for it. */
  styleJson: Record<string, unknown> | null;
  mapCenter: MapCenter;
  zoomLevel: number;
  minZoom?: number;
  maxZoom?: number;
  displayMode: boolean;
  basemapToggle: boolean;
  shouldShowMarker: boolean;
  precisionRef: React.MutableRefObject<CellPrecision>;
  /** Latest question value — read through a ref so the map handlers never go
   * stale while the map instance itself is never re-created. */
  valueRef: React.MutableRefObject<ValueLike>;
  onFeatureClick?: Props['getFeatureCollectionOnClick'];
  onError: (message: string) => void;
  /** Cached one-shot geolocation — renders the pulsing "you are here" dot. */
  userPosition?: GeolocationPosition;
}) {
  const {
    mapId,
    styleJson,
    mapCenter,
    zoomLevel,
    minZoom,
    maxZoom,
    displayMode,
    basemapToggle,
    shouldShowMarker,
    precisionRef,
    valueRef,
    onFeatureClick,
    onError,
    userPosition,
  } = options;
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const userDotRef = useRef<maplibregl.Marker | null>(null);
  const isInitialized = useRef(false);
  /** Custom sources/layers exist only after the style's `load` event. */
  const styleReady = useRef(false);
  // Once the user explicitly selects a location (map click or manual entry),
  // the marker belongs to that selection — stop syncing it to the map center.
  const hasExplicitSelection = useRef(false);
  // Monotonic id per selection attempt: a slow reverse geocode resolving after
  // a newer tap must not overwrite the newer selection.
  const selectSeq = useRef(0);
  // Read through a ref by the click listener (registered once at init) so a
  // later flip of shouldShowMarker isn't lost to the stale closure.
  const shouldShowMarkerRef = useRef(shouldShowMarker);
  shouldShowMarkerRef.current = shouldShowMarker;

  const refreshGrid = useCallback(() => {
    const map = mapRef.current;
    if (!map || !styleReady.current) return;
    const source = map.getSource(GRID_SOURCE) as maplibregl.GeoJSONSource | undefined;
    source?.setData(buildGridData(map, precisionRef.current));
  }, [precisionRef]);

  const refreshSelection = useCallback(() => {
    const map = mapRef.current;
    if (!map || !styleReady.current) return;
    const source = map.getSource(SELECTION_SOURCE) as maplibregl.GeoJSONSource | undefined;
    source?.setData(buildSelectionData(valueRef.current, precisionRef.current));
  }, [precisionRef, valueRef]);

  const setSatellite = useCallback((satellite: boolean) => {
    const map = mapRef.current;
    if (!map || !styleReady.current) return;
    map.setLayoutProperty(SATELLITE_LAYER, 'visibility', satellite ? 'visible' : 'none');
    map.setPaintProperty(GRID_LAYER, 'line-color', satellite ? GRID_COLOR_SATELLITE : GRID_COLOR_VECTOR);
  }, []);

  // Shared selection flow used by both map clicks and manual coordinate entry:
  // resolve the grid cell locally, reverse geocode it (best effort), place the
  // marker and notify the widget.
  const selectAtCoordinates = useCallback(
    async (rawLng: number, lat: number, showMarker: boolean) => {
      const map = mapRef.current;
      if (!map || !onFeatureClick || displayMode) return;
      // Clicks on wrapped world copies (low zoom / antimeridian) report
      // longitudes outside [-180, 180); normalize so the geohash encoder and
      // the stored coordinate are both valid.
      const lng = ((((rawLng + 180) % 360) + 360) % 360) - 180;
      const seq = ++selectSeq.current;
      const currentPrecision = precisionRef.current;
      const cell = getCell({ lng, lat }, currentPrecision);
      const clickedCell: ClickedCell = {
        locationId: cell.locationId,
        coordinates: [lng, lat],
      };
      let featureCollection: FeatureCollection | null = null;
      try {
        featureCollection = await reverseGeocode(lat, lng);
      } catch (error) {
        // Not reported further: the error/URL could carry the user-picked location.
        console.warn('Reverse geocode failed — selecting the cell without address details:', error);
      }
      // A newer selection started while this one awaited — drop this result.
      if (seq !== selectSeq.current) return;
      if (markerRef.current) {
        markerRef.current.setLngLat([lng, lat]);
      } else if (showMarker) {
        markerRef.current = new maplibregl.Marker().setLngLat([lng, lat]).addTo(map);
      }
      hasExplicitSelection.current = true;
      onFeatureClick(featureCollection, clickedCell, currentPrecision);
    },
    [onFeatureClick, displayMode, precisionRef],
  );

  const initializeMap = useCallback(() => {
    if (!styleJson) return;
    const element = document.getElementById(mapId);
    if (!element) return;
    // Prevent double initialization on re-renders of THIS instance.
    if (isInitialized.current) return;
    // A previous mount can leave DOM behind (StrictMode's dev remount hits
    // this). Claim the container instead of bailing out: a leftover map has
    // no owner, so its marker/refs would never update.
    if (element.children.length > 0) element.replaceChildren();

    try {
      const map = new maplibregl.Map({
        container: mapId,
        style: styleJson as unknown as maplibregl.StyleSpecification,
        center: mapCenter,
        zoom: zoomLevel,
        minZoom,
        maxZoom,
      });

      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-left');
      // Grid-size picker — later clicks encode at the precision the user
      // picked (parity with the UNL SDK's "Choose Grid Size" control).
      map.addControl(
        new GridSizeControl({
          initialPrecision: precisionRef.current,
          onSelect: (precision) => {
            precisionRef.current = precision;
            refreshGrid();
          },
        }),
        'top-right',
      );
      if (basemapToggle) {
        map.addControl(new BasemapToggleControl({ onToggle: setSatellite }), 'top-right');
      }

      // Custom layers only exist once the HERE style has loaded. Order:
      // satellite under the overlays, selection fill/outline, grid lines.
      map.on('load', () => {
        map.addSource(SATELLITE_SOURCE, {
          type: 'raster',
          tiles: [getHereSatelliteTileUrl()],
          tileSize: 512,
          maxzoom: SATELLITE_TILE_MAX_ZOOM,
        });
        map.addLayer({
          id: SATELLITE_LAYER,
          type: 'raster',
          source: SATELLITE_SOURCE,
          layout: { visibility: 'none' },
        });
        map.addSource(SELECTION_SOURCE, { type: 'geojson', data: EMPTY_FC });
        map.addLayer({
          id: SELECTION_FILL_LAYER,
          type: 'fill',
          source: SELECTION_SOURCE,
          paint: { 'fill-color': SELECTION_COLOR, 'fill-opacity': 0.15 },
        });
        map.addLayer({
          id: SELECTION_OUTLINE_LAYER,
          type: 'line',
          source: SELECTION_SOURCE,
          paint: { 'line-color': SELECTION_COLOR, 'line-width': 1.5 },
        });
        map.addSource(GRID_SOURCE, { type: 'geojson', data: EMPTY_FC });
        map.addLayer({
          id: GRID_LAYER,
          type: 'line',
          source: GRID_SOURCE,
          paint: { 'line-color': GRID_COLOR_VECTOR, 'line-width': 0.75 },
        });
        styleReady.current = true;
        refreshGrid();
        refreshSelection();

        if (onFeatureClick && !displayMode) {
          // Registered only once the style (and grid overlay) actually
          // rendered — a blank map that failed to load must not accept
          // invisible selections. The cell itself is pure geohash math, so a
          // tap still selects even when the reverse geocode has nothing to
          // say about the location.
          map.on('click', (e) => {
            void selectAtCoordinates(e.lngLat.lng, e.lngLat.lat, shouldShowMarkerRef.current);
          });
        }
      });
      // moveend also fires after zooms/flyTo — one listener covers all camera
      // changes.
      map.on('moveend', refreshGrid);

      // maplibre surfaces async tile/glyph failures via 'error' events.
      // They're per-request and recoverable — the map keeps rendering
      // everything else — so they're logged, never fatal. (Style-fetch
      // failure IS fatal and is handled where the style is fetched.) The api
      // key is stripped from the message to keep logs clean.
      map.on('error', (e) => {
        const raw = (e as { error?: unknown }).error;
        const message = errMsg(raw, 'map tile request failed').replace(/api_?key=[^&\s]+/gi, 'apikey=***');
        console.warn('[here-map] tile error:', message);
      });

      // Pulsing "you are here" dot at the cached geolocation. Clipped by the
      // viewport automatically, so it only shows when the spot is in view.
      if (userPosition) {
        const dot = document.createElement('div');
        dot.className = 'map-user-location-dot';
        userDotRef.current = new maplibregl.Marker({ element: dot })
          .setLngLat([userPosition.coords.longitude, userPosition.coords.latitude])
          .addTo(map);
      }

      // When the dot marks the user, the teardrop pin is reserved for the
      // SELECTION and first appears on tap/manual entry (deliberate divergence
      // from impacts-x, where the pin sits on the map center from the start —
      // overlapping glyphs on the same spot read as clutter).
      if (shouldShowMarker && !userDotRef.current) {
        markerRef.current = new maplibregl.Marker().setLngLat(mapCenter).addTo(map);
      }

      mapRef.current = map;
      isInitialized.current = true;
    } catch (error) {
      console.error('Failed to initialize map:', error);
      onError(error instanceof Error ? error.message : 'Failed to initialize map');
    }
  }, [
    mapId,
    styleJson,
    mapCenter,
    zoomLevel,
    minZoom,
    maxZoom,
    displayMode,
    basemapToggle,
    shouldShowMarker,
    precisionRef,
    onFeatureClick,
    onError,
    selectAtCoordinates,
    refreshGrid,
    refreshSelection,
    setSatellite,
    userPosition,
  ]);

  const updateMarkerPosition = useCallback(
    (newCenter: MapCenter) => {
      if (markerRef.current && !displayMode && !hasExplicitSelection.current) {
        markerRef.current.setLngLat(newCenter);
      }
    },
    [displayMode],
  );

  // The "you are here" dot is normally created during init; when geolocation
  // resolves only after the map is up (focusOnUser=false questions — init
  // doesn't wait for the fix), add it here instead.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !userPosition || userDotRef.current) return;
    const dot = document.createElement('div');
    dot.className = 'map-user-location-dot';
    userDotRef.current = new maplibregl.Marker({ element: dot })
      .setLngLat([userPosition.coords.longitude, userPosition.coords.latitude])
      .addTo(map);
  }, [userPosition]);

  const cleanup = useCallback(() => {
    for (const ref of [markerRef, userDotRef]) {
      if (ref.current) {
        try {
          ref.current.remove();
        } catch {
          // intentionally silent: marker already detached
        }
        ref.current = null;
      }
    }
    const map = mapRef.current;
    if (map) {
      try {
        map.remove();
      } catch {
        // intentionally silent: already torn down — nothing left to release
      }
      mapRef.current = null;
      isInitialized.current = false;
      styleReady.current = false;
    }
    // Drop whatever maplibre left behind so the next mount starts clean.
    document.getElementById(mapId)?.replaceChildren();
  }, [mapId]);

  return {
    initializeMap,
    cleanup,
    updateMarkerPosition,
    selectAtCoordinates,
    refreshSelection,
    mapRef,
  };
}

/** Imperative handle for the widget's manual coordinate entry. */
export type HereMapHandle = {
  selectCoordinates: (lat: number, lng: number) => Promise<void>;
};

const HereMap = React.forwardRef<HereMapHandle, Props>(function HereMap(
  {
    mapId = MAP_HTML_ELEMENT_ID,
    value,
    displayMode = false,
    center,
    // Default mirrors the serializer's (7).
    gridPrecision = CellPrecision.GEOHASH_LENGTH_7,
    minZoom,
    maxZoom,
    focusOnUser = false,
    basemapToggle = true,
    getFeatureCollectionOnClick,
  }: Props,
  ref,
) {
  // Graceful degradation: without an API key the map renders a stub notice
  // (mirrors the old UnlMap contract) and never fetches anything from HERE.
  const configured = hasHereConfig();

  const [mapError, setMapError] = React.useState<string | null>(null);
  const [styleJson, setStyleJson] = React.useState<Record<string, unknown> | null>(null);

  // Fetch the zoom-capped HERE style before constructing the map. A failure
  // here is the "map cannot render at all" case (e.g. bad API key) — the one
  // that shows the visible error state.
  useEffect(() => {
    if (!configured) return;
    let live = true;
    getPatchedHereStyle()
      .then((style) => {
        if (live) setStyleJson(style);
      })
      .catch((error) => {
        if (!live) return;
        console.error('Failed to load map style:', error);
        setMapError(errMsg(error, 'Failed to load map style'));
      });
    return () => {
      live = false;
    };
  }, [configured]);

  // An existing answer wins over the question's configured precision, so a
  // saved selection re-renders on the grid it was captured with.
  const initialPrecision = firstCell(value)?.gridPrecision ?? gridPrecision;
  const precisionRef = useRef<CellPrecision>(initialPrecision);
  const valueRef = useRef<ValueLike>(value);

  const zoomLevel = getCellPrecisionZoom(initialPrecision);
  const { mapCenter, position, isGeolocationLoading } = useMapCenter(
    center,
    focusOnUser,
    value,
    displayMode,
    configured && !displayMode,
  );

  const shouldShowMarker = displayMode ? Boolean(firstCell(value)) : Boolean(focusOnUser || center || position);

  const { initializeMap, cleanup, updateMarkerPosition, selectAtCoordinates, refreshSelection, mapRef } =
    useMapInstance({
      mapId,
      styleJson,
      mapCenter,
      zoomLevel,
      minZoom,
      maxZoom,
      displayMode,
      basemapToggle,
      shouldShowMarker,
      precisionRef,
      valueRef,
      onFeatureClick: getFeatureCollectionOnClick,
      onError: setMapError,
      userPosition: position,
    });

  // Initialize once the style has arrived (initializeMap no-ops while
  // styleJson is null). Only focusOnUser waits for geolocation to settle —
  // it drives the initial center; otherwise the fix resolves in background
  // (the dot/recenter appear when it lands).
  useEffect(() => {
    if (!(focusOnUser && isGeolocationLoading)) initializeMap();
  }, [initializeMap, focusOnUser, isGeolocationLoading]);

  // The cell highlight follows the question value (taps, manual entry, and
  // saved answers in display mode).
  useEffect(() => {
    valueRef.current = value;
    refreshSelection();
  }, [value, refreshSelection]);

  // The marker follows the resolved center (e.g. geolocation arriving late).
  useEffect(() => {
    if (!isGeolocationLoading && shouldShowMarker && !displayMode) {
      updateMarkerPosition(mapCenter);
    }
  }, [mapCenter, isGeolocationLoading, shouldShowMarker, displayMode, updateMarkerPosition]);

  useEffect(() => cleanup, [cleanup]);

  // The error state replaces the map container in the render — release the
  // map (WebGL context) right away instead of waiting for unmount.
  useEffect(() => {
    if (mapError) cleanup();
  }, [mapError, cleanup]);

  // Manual coordinate entry (widget inputs) — fly there, then run the same
  // selection flow as a tap.
  React.useImperativeHandle(
    ref,
    () => ({
      selectCoordinates: async (lat: number, lng: number) => {
        const map = mapRef.current;
        if (map) {
          // flyTo's default animation scales with distance; at high zoom a
          // far-away target takes near-forever, so the viewport never reaches
          // the marker. Cap the flight so the map lands on the coordinates.
          map.flyTo({ center: [lng, lat], maxDuration: 2000 });
        }
        // Always show the marker for manually entered coordinates so the
        // user gets visual confirmation of the selected location.
        await selectAtCoordinates(lng, lat, true);
      },
    }),
    [selectAtCoordinates, mapRef],
  );

  // Pan back to the position cached by the one-shot geolocation at mount —
  // never re-requests the location, never moves the marker.
  const recenter = useCallback(() => {
    const map = mapRef.current;
    if (!map || !position) return;
    map.flyTo({
      center: [position.coords.longitude, position.coords.latitude],
    });
  }, [mapRef, position]);

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
        Map unavailable — HERE credentials are not configured. Set <code>NEXT_PUBLIC_HERE_API_KEY</code> to enable
        location capture.
      </div>
    );
  }

  if (mapError) {
    return <div style={{ minHeight: '400px' }}>Error loading map: {mapError}</div>;
  }

  if ((focusOnUser && isGeolocationLoading) || !styleJson) {
    return <div style={{ minHeight: '400px' }}>Loading...</div>;
  }

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <div id={mapId} className='here-map-root' style={{ top: 0, bottom: 0, width: '100%', minHeight: '400px' }} />
      {position && (
        <button
          type='button'
          aria-label='Recenter map on your location'
          onClick={recenter}
          // Literals on purpose: mirrors maplibre's control chrome (29×29,
          // 4px radius, 2px ring, 10px inset) so it matches the grid / layers
          // buttons on the same map, not the app's button tokens.
          style={{
            position: 'absolute',
            right: '10px',
            bottom: '10px',
            width: '29px',
            height: '29px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
            border: 0,
            borderRadius: '4px',
            background: '#fff',
            color: '#333',
            boxShadow: '0 0 0 2px rgba(0, 0, 0, 0.1)',
            cursor: 'pointer',
            zIndex: 2,
          }}
        >
          {/* crosshair "my location" glyph */}
          <svg
            width='18'
            height='18'
            viewBox='0 0 24 24'
            fill='none'
            stroke='currentColor'
            strokeWidth='2'
            strokeLinecap='round'
            aria-hidden='true'
          >
            <circle cx='12' cy='12' r='7' />
            <circle cx='12' cy='12' r='2' fill='currentColor' stroke='none' />
            <line x1='12' y1='2' x2='12' y2='5' />
            <line x1='12' y1='19' x2='12' y2='22' />
            <line x1='2' y1='12' x2='5' y2='12' />
            <line x1='19' y1='12' x2='22' y2='12' />
          </svg>
        </button>
      )}
    </div>
  );
});

export default HereMap;
