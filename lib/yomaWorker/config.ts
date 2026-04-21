export const JAMBO_WORKER_URL = (process.env.NEXT_PUBLIC_JAMBO_WORKER_URL || '').trim().replace(/\/+$/, '');

// Client-side requests go through the Next.js API proxy (pages/api/yomaWorker/[...path].ts)
// to avoid CORS failures when talking to the jambo worker directly.
export const JAMBO_WORKER_API_BASE = '/api/yomaWorker';

export const IS_JAMBO_WORKER_ENABLED = !!JAMBO_WORKER_URL;
