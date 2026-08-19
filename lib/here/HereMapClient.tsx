import dynamic from 'next/dynamic';

// SSR boundary: maplibre-gl touches window/document at import time, so the map
// only ever loads in the browser. Type-only re-exports are erased at compile
// time and therefore safe to cross the boundary.
export type { ClickedCell, Feature, FeatureCollection, HereMapHandle } from './HereMap';

export default dynamic(() => import('./HereMap'), { ssr: false });
