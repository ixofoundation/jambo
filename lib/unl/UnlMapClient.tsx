import dynamic from 'next/dynamic';

// `unl-map-js` and `maplibre-gl` touch `window` at module load — keep them out of the
// server bundle by gating the entire UnlMap component behind next/dynamic with ssr off.
export default dynamic(() => import('./UnlMap'), { ssr: false });
