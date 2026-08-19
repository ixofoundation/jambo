/**
 * The Yoma opportunity-pull-synchronisation worker (the partner API Yoma
 * calls) — distinct from the jambo worker. It hosts the jambo-facing
 * DID ↔ Yoma link endpoints (/v1/link/*) and its did:web document.
 */
export const YOMA_SYNC_WORKER_URL = (process.env.NEXT_PUBLIC_YOMA_SYNC_WORKER_URL || '').trim().replace(/\/+$/, '');

/** Browser-side base — proxied through a Next API route to avoid CORS. */
export const YOMA_SYNC_API_BASE = '/api/yomaSync';
