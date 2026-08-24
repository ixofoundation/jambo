/**
 * Deck preferences — which opportunity cards the user saved for later or
 * passed on, plus the one-time tutorial flag.
 *
 * Storage model (Matrix-first, local fallback):
 * - In-memory state + a per-account localStorage mirror keep every read and
 *   write synchronous, so the deck stays instant and still works when Matrix
 *   is unavailable (dev bypass, outages).
 * - Matrix global account data (`in.ixo.yoma.preferences`) is the source of
 *   truth whenever a session exists: hydration replaces the local mirror with
 *   whatever Matrix holds, and every local mutation is written back
 *   (debounced). The payload nests everything under a `v1` key so a future
 *   client can introduce `v2` alongside it; unknown sibling keys are preserved
 *   on write so an older client never clobbers a newer one.
 * - Applying/claiming stays the real on-chain flow — these are taste signals.
 */

import { ClientEvent } from 'matrix-js-sdk';
import type { MatrixClient, MatrixEvent } from 'matrix-js-sdk';

import cons from '@constants/matrix';

const KEY_PREFIX = 'yoma_deck_';
const SKIPPED_BASE = `${KEY_PREFIX}skipped`;
const SAVED_BASE = `${KEY_PREFIX}saved`;
const TUTORIAL_BASE = `${KEY_PREFIX}tutorial_done`;
/** Pre-namespacing key names (pre-Matrix builds) — migrated once, then removed. */
const LEGACY_KEYS: Array<[legacy: string, base: string]> = [
  ['yoma_deck_skipped', SKIPPED_BASE],
  ['yoma_deck_saved', SAVED_BASE],
  ['yoma_deck_tutorial_done', TUTORIAL_BASE],
];
const PERSIST_DEBOUNCE_MS = 800;

export interface DeckPrefs {
  saved: string[];
  skipped: string[];
  tutorialDone: boolean;
}

interface DeckAccountDataV1 {
  deck: DeckPrefs;
  updatedAt: number;
}

const EMPTY: DeckPrefs = { saved: [], skipped: [], tutorialDone: false };

let address: string | null = null;
let loaded = false;
let prefs: DeckPrefs = EMPTY;
/** Local mutations not yet written to Matrix. */
let dirty = false;

let mxClient: MatrixClient | null = null;
let persistTimer: ReturnType<typeof setTimeout> | null = null;
let flushOnHideBound = false;
/** True once a Matrix hydration attempt has settled (applied, seeded, or failed). */
let hydrated = false;

const listeners = new Set<() => void>();

const storageKey = (base: string) => (address ? `${base}:${address}` : base);

function readList(key: string): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function writeList(key: string, ids: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(ids));
  } catch {
    // storage full/blocked — deck prefs are best-effort
  }
}

function readFlag(key: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function writeFlag(key: string, done: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    if (done) window.localStorage.setItem(key, '1');
    else window.localStorage.removeItem(key);
  } catch {
    // best-effort
  }
}

function notify(): void {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch {
      // one bad subscriber must not break the rest
    }
  });
}

function loadFromStorage(): void {
  prefs = {
    saved: readList(storageKey(SAVED_BASE)),
    skipped: readList(storageKey(SKIPPED_BASE)),
    tutorialDone: readFlag(storageKey(TUTORIAL_BASE)),
  };
  loaded = true;
}

function mirrorToStorage(): void {
  writeList(storageKey(SAVED_BASE), prefs.saved);
  writeList(storageKey(SKIPPED_BASE), prefs.skipped);
  writeFlag(storageKey(TUTORIAL_BASE), prefs.tutorialDone);
}

function ensureLoaded(): void {
  if (!loaded) loadFromStorage();
}

/**
 * Bind deck prefs to the logged-in account. Keys are namespaced per address so
 * a shared browser never leaks one user's deck into another's; legacy
 * un-namespaced keys migrate once into the activating account. Idempotent.
 */
export function activateDeckPrefs(nextAddress: string | null | undefined): void {
  const normalized = nextAddress || null;
  if (loaded && normalized === address) return;
  address = normalized;
  if (typeof window !== 'undefined' && address) {
    try {
      LEGACY_KEYS.forEach(([legacy, base]) => {
        const value = window.localStorage.getItem(legacy);
        if (value === null || legacy === storageKey(base)) return;
        if (window.localStorage.getItem(storageKey(base)) === null) {
          window.localStorage.setItem(storageKey(base), value);
        }
        window.localStorage.removeItem(legacy);
      });
    } catch {
      // best-effort
    }
  }
  loadFromStorage();
  notify();
}

/** Subscribe to any change: local mutation, Matrix hydration, cross-device update. */
export function subscribeDeckPrefs(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export const getSaved = (): string[] => {
  ensureLoaded();
  return prefs.saved;
};

export const getSkipped = (): string[] => {
  ensureLoaded();
  return prefs.skipped;
};

export const isDeckTutorialDone = (): boolean => {
  ensureLoaded();
  return prefs.tutorialDone;
};

/** Whether Matrix hydration has settled this session (regardless of outcome). */
export const isDeckPrefsHydrated = (): boolean => hydrated;

function commit(next: DeckPrefs): void {
  prefs = next;
  mirrorToStorage();
  schedulePersist();
  notify();
}

export function skipCard(id: string): string[] {
  ensureLoaded();
  commit({ ...prefs, skipped: Array.from(new Set([...prefs.skipped, id])) });
  return prefs.skipped;
}

export function saveCard(id: string): string[] {
  ensureLoaded();
  commit({ ...prefs, saved: Array.from(new Set([...prefs.saved, id])) });
  return prefs.saved;
}

/** Bring a card back into the deck from either stack. */
export function restoreCard(id: string): { saved: string[]; skipped: string[] } {
  ensureLoaded();
  commit({
    ...prefs,
    saved: prefs.saved.filter((x) => x !== id),
    skipped: prefs.skipped.filter((x) => x !== id),
  });
  return { saved: prefs.saved, skipped: prefs.skipped };
}

export function restoreAllSkipped(): string[] {
  ensureLoaded();
  commit({ ...prefs, skipped: [] });
  return prefs.skipped;
}

export function setDeckTutorialDone(): void {
  ensureLoaded();
  if (prefs.tutorialDone) return;
  commit({ ...prefs, tutorialDone: true });
}

// ---------------------------------------------------------------------------
// Matrix account data
// ---------------------------------------------------------------------------

function sanitizeRemote(raw: unknown): DeckPrefs | null {
  if (!raw || typeof raw !== 'object') return null;
  const deck = (raw as { deck?: unknown }).deck;
  if (!deck || typeof deck !== 'object') return null;
  const list = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  const d = deck as Record<string, unknown>;
  return { saved: list(d.saved), skipped: list(d.skipped), tutorialDone: d.tutorialDone === true };
}

const samePrefs = (a: DeckPrefs, b: DeckPrefs): boolean => JSON.stringify(a) === JSON.stringify(b);

function applyRemote(remote: DeckPrefs): void {
  if (samePrefs(prefs, remote)) return;
  prefs = remote;
  mirrorToStorage();
  notify();
}

function schedulePersist(): void {
  dirty = true;
  if (!mxClient || typeof window === 'undefined') return;
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    void flushDeckPrefs();
  }, PERSIST_DEBOUNCE_MS);
}

/** Write pending local changes to Matrix account data now (best-effort). */
export async function flushDeckPrefs(): Promise<void> {
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  const client = mxClient;
  if (!client || !dirty) return;
  dirty = false;
  try {
    // Spread the existing content so sibling keys survive — a future client's
    // `v2` must never be dropped by this client's v1 write.
    const existing = client.getAccountData(cons.IN_IXO_YOMA_PREFERENCES)?.getContent() ?? {};
    const v1: DeckAccountDataV1 = {
      deck: { saved: prefs.saved, skipped: prefs.skipped, tutorialDone: prefs.tutorialDone },
      updatedAt: Date.now(),
    };
    await client.setAccountData(cons.IN_IXO_YOMA_PREFERENCES, { ...existing, v1 });
  } catch (err) {
    dirty = true; // retried on the next mutation or flush
    console.warn('Deck prefs Matrix persist failed:', err);
  }
}

/** Live cross-device updates from the sync loop (also echoes our own writes). */
const onAccountData = (event: MatrixEvent): void => {
  if (event.getType() !== cons.IN_IXO_YOMA_PREFERENCES) return;
  // A pending local write is about to replace the server value anyway.
  if (dirty) return;
  const remote = sanitizeRemote((event.getContent() as { v1?: unknown })?.v1);
  if (remote) applyRemote(remote);
};

/**
 * Attach the Matrix session once the sync client is PREPARED. Precedence:
 * - Matrix has a value → it wins over the local mirror (unless the user made
 *   fresh, still-unpersisted choices this session, which are unioned in rather
 *   than reverted, then written back).
 * - Matrix has no value yet → seed it from local state (one-time migration).
 * Safe to call again after a client retry.
 */
export async function hydrateDeckPrefsFromMatrix(client: MatrixClient): Promise<void> {
  ensureLoaded();
  try {
    if (mxClient && mxClient !== client) mxClient.removeListener(ClientEvent.AccountData, onAccountData);
    if (mxClient !== client) {
      mxClient = client;
      client.on(ClientEvent.AccountData, onAccountData);
    }
    if (!flushOnHideBound && typeof window !== 'undefined') {
      flushOnHideBound = true;
      window.addEventListener('pagehide', () => {
        void flushDeckPrefs();
      });
    }

    const content = client.getAccountData(cons.IN_IXO_YOMA_PREFERENCES)?.getContent() as
      | { v1?: unknown }
      | undefined;
    const remote = sanitizeRemote(content?.v1);

    if (!remote) {
      dirty = true;
      await flushDeckPrefs();
      return;
    }

    if (dirty) {
      const saved = Array.from(new Set([...remote.saved, ...prefs.saved]));
      const savedSet = new Set(saved);
      prefs = {
        saved,
        skipped: Array.from(new Set([...remote.skipped, ...prefs.skipped])).filter((x) => !savedSet.has(x)),
        tutorialDone: remote.tutorialDone || prefs.tutorialDone,
      };
      mirrorToStorage();
      notify();
      await flushDeckPrefs();
      return;
    }

    applyRemote(remote);
  } finally {
    // Settle regardless of outcome so screens holding for hydration release.
    hydrated = true;
    notify();
  }
}

/**
 * Logout wipe: remove every deck key (all accounts + legacy) so the next login
 * on this browser can never see the previous user's deck — even if their
 * Matrix session fails — and detach from the Matrix client.
 */
export function clearDeckPrefsStorage(): void {
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  dirty = false;
  if (mxClient) {
    mxClient.removeListener(ClientEvent.AccountData, onAccountData);
    mxClient = null;
  }
  if (typeof window !== 'undefined') {
    try {
      const doomed: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key && key.startsWith(KEY_PREFIX)) doomed.push(key);
      }
      doomed.forEach((key) => window.localStorage.removeItem(key));
    } catch {
      // best-effort
    }
  }
  address = null;
  prefs = EMPTY;
  loaded = false;
  hydrated = false;
  notify();
}
