import { returnablePath } from '@utils/returnTo';

/**
 * PKCE (RFC 7636, S256 only) and the CSRF `state` for auth-hub sign-in.
 *
 * Every sign-in start makes a fresh verifier and state and keeps them, with
 * the deep link to land on afterwards, in this browser's localStorage under a
 * key named after the state. The callback takes the entry for the `state` it
 * was given, once: it is deleted on read, so a replayed callback finds none.
 *
 * Why localStorage and not this tab's sessionStorage: a Yoma sign-in can
 * finish in another tab of the same browser. Yoma's login asks a person to
 * verify their email first, and the link in that email opens a new tab, where
 * Yoma continues the sign-in and the hub then returns to /auth/callback. With
 * per-tab storage that tab would hold nothing and the sign-in would fail.
 * localStorage is the narrowest storage that still covers it: same browser
 * and same origin only, never another browser or device. Entries are bound to
 * their state, expire after MAX_AGE_MS and are pruned on every start.
 */

const RANDOM_BYTES = 32;
const KEY_PREFIX = 'ixo_auth_hub_pending:';
// A Yoma sign-in can include signing up and verifying an email address.
const MAX_AGE_MS = 30 * 60 * 1000;
// Starts that were never finished (back button, closed tab) linger until they
// expire; keep only the newest few.
const MAX_ENTRIES = 5;
// Tolerate a device clock that moved back a little between start and return.
const CLOCK_SKEW_MS = 5 * 60 * 1000;
const VERIFIER = /^[A-Za-z0-9._~-]{43,128}$/;
const STATE = /^[A-Za-z0-9_-]{43,128}$/;

export interface PendingSignIn {
  state: string;
  verifier: string;
  returnTo: string | null;
}

/** What the callback finds for a state: a field is null when it was missing or malformed. */
export interface StoredSignIn {
  state: string | null;
  verifier: string | null;
  returnTo: string | null;
}

export function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function randomBase64Url(byteLength: number): string {
  if (typeof globalThis.crypto?.getRandomValues !== 'function') {
    throw new Error('Secure random numbers are not available in this browser');
  }
  return base64UrlEncode(globalThis.crypto.getRandomValues(new Uint8Array(byteLength)));
}

export const isValidCodeVerifier = (value: unknown): value is string =>
  typeof value === 'string' && VERIFIER.test(value);

export const isValidState = (value: unknown): value is string => typeof value === 'string' && STATE.test(value);

/** 32 random bytes, base64url: a 43-character verifier. */
export const createCodeVerifier = (): string => randomBase64Url(RANDOM_BYTES);

/** 32 random bytes, base64url: a 43-character state. */
export const createState = (): string => randomBase64Url(RANDOM_BYTES);

/** base64url(SHA-256(verifier)) via WebCrypto. Throws rather than ever falling back to `plain`. */
export async function codeChallengeS256(verifier: string): Promise<string> {
  if (!isValidCodeVerifier(verifier)) throw new Error('Invalid PKCE code verifier');
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error('Secure sign-in needs a secure (https) connection');
  const digest = await subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return base64UrlEncode(new Uint8Array(digest));
}

function storage(): Storage {
  return globalThis.localStorage;
}

function pendingKeys(store: Storage): string[] {
  const keys: string[] = [];
  for (let i = 0; i < store.length; i += 1) {
    const key = store.key(i);
    if (key && key.startsWith(KEY_PREFIX)) keys.push(key);
  }
  return keys;
}

function entryTime(store: Storage, key: string): number | null {
  try {
    const ts = (JSON.parse(store.getItem(key) ?? 'null') as { ts?: unknown } | null)?.ts;
    return typeof ts === 'number' ? ts : null;
  } catch {
    return null;
  }
}

function isFresh(ts: unknown, now: number): boolean {
  return typeof ts === 'number' && ts <= now + CLOCK_SKEW_MS && now - ts <= MAX_AGE_MS;
}

/** Drop expired and malformed entries, then all but the newest `keep`. */
function prune(store: Storage, now: number, keep: number): void {
  const live: Array<{ key: string; ts: number }> = [];
  for (const key of pendingKeys(store)) {
    const ts = entryTime(store, key);
    if (!isFresh(ts, now)) store.removeItem(key);
    else live.push({ key, ts: ts as number });
  }
  live.sort((a, b) => b.ts - a.ts);
  for (const { key } of live.slice(Math.max(keep, 0))) store.removeItem(key);
}

/**
 * Keep a sign-in for its callback. Throws when the browser cannot keep it: a
 * sign-in that cannot be checked on return must not start.
 */
export function savePendingSignIn(pending: PendingSignIn, now: number = Date.now()): void {
  if (!isValidState(pending.state) || !isValidCodeVerifier(pending.verifier)) throw new Error('Invalid sign-in state');
  const store = storage();
  prune(store, now, MAX_ENTRIES - 1);
  store.setItem(
    KEY_PREFIX + pending.state,
    JSON.stringify({
      state: pending.state,
      verifier: pending.verifier,
      returnTo: returnablePath(pending.returnTo),
      ts: now,
    }),
  );
}

/**
 * Take the sign-in started for `state`, once: the entry is deleted whatever it
 * holds. Null when there is none (never started in this browser, already
 * used, expired) or the state itself is malformed.
 */
export function takePendingSignIn(state: string | null | undefined, now: number = Date.now()): StoredSignIn | null {
  if (!isValidState(state)) return null;
  let raw: string | null = null;
  try {
    const store = storage();
    raw = store.getItem(KEY_PREFIX + state);
    store.removeItem(KEY_PREFIX + state);
  } catch {
    // Storage is unavailable: nothing was kept, so there is nothing to take.
    return null;
  }
  if (!raw) return null;

  let value: Partial<Record<keyof StoredSignIn | 'ts', unknown>>;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!value || typeof value !== 'object') return null;
  if (!isFresh(value.ts, now)) return null;
  return {
    state: isValidState(value.state) ? value.state : null,
    verifier: isValidCodeVerifier(value.verifier) ? value.verifier : null,
    returnTo: returnablePath(value.returnTo),
  };
}
