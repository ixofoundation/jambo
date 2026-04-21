export const JAMBO_WORKER_URL = (process.env.NEXT_PUBLIC_JAMBO_WORKER_URL || '').trim().replace(/\/+$/, '');

export const IS_JAMBO_WORKER_ENABLED = !!JAMBO_WORKER_URL;
