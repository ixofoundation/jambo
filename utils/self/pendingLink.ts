import type { PendingSelfLink } from 'types/kyc';

/**
 * The open Self check, remembered per DID on this device so the app can keep
 * showing its progress after a reload. Only the link's id is kept: the link
 * URL is a bearer secret and is never stored. The id alone is useless: reading
 * a link's status needs a delegation signed by the person's key.
 */
const KEY_PREFIX = 'jambo.self.pendingLink:';
/** A check can sit in manual review for up to 48 hours; forget it after 3 days. */
const MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000;
const LINK_ID = /^[A-Za-z0-9-]{8,64}$/;

function storage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function loadPendingSelfLink(did: string): PendingSelfLink | null {
  const store = storage();
  if (!store || !did) return null;
  try {
    const raw = store.getItem(KEY_PREFIX + did);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PendingSelfLink>;
    if (typeof parsed.linkId !== 'string' || !LINK_ID.test(parsed.linkId) || typeof parsed.startedAt !== 'number') {
      store.removeItem(KEY_PREFIX + did);
      return null;
    }
    if (Date.now() - parsed.startedAt > MAX_AGE_MS) {
      store.removeItem(KEY_PREFIX + did);
      return null;
    }
    return { linkId: parsed.linkId, startedAt: parsed.startedAt };
  } catch {
    return null;
  }
}

export function savePendingSelfLink(did: string, linkId: string): void {
  const store = storage();
  if (!store || !did || !LINK_ID.test(linkId)) return;
  try {
    const value: PendingSelfLink = { linkId, startedAt: Date.now() };
    store.setItem(KEY_PREFIX + did, JSON.stringify(value));
  } catch {
    // Storage full or blocked: the check still works, it just is not remembered.
  }
}

export function clearPendingSelfLink(did: string): void {
  const store = storage();
  if (!store || !did) return;
  try {
    store.removeItem(KEY_PREFIX + did);
  } catch {
    // nothing to clear
  }
}
