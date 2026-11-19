/**
 * "Use the new identity check instead": a person whose old identity check
 * (ixo-kyc-server) is stalled or abandoned may leave it and do the Self check.
 * Remembered per DID on this device. The flag holds no personal data, and the
 * old check itself is left as it is on the server.
 */
const KEY_PREFIX = 'jambo.kyc.skipLegacy:';

type FlagStore = Pick<Storage, 'getItem' | 'setItem'>;

function browserStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function isLegacyKycSkipped(
  did: string | null | undefined,
  store: FlagStore | null = browserStorage(),
): boolean {
  if (!store || !did) return false;
  try {
    return store.getItem(KEY_PREFIX + did) === '1';
  } catch {
    return false;
  }
}

/** False = it could not be remembered (storage blocked); it then holds for this visit only. */
export function skipLegacyKyc(did: string | null | undefined, store: FlagStore | null = browserStorage()): boolean {
  if (!store || !did) return false;
  try {
    store.setItem(KEY_PREFIX + did, '1');
    return true;
  } catch {
    return false;
  }
}

/** Undoes `skipLegacyKyc` for this person on this device. */
export function clearLegacyOptOut(
  did: string | null | undefined,
  store: Pick<Storage, 'removeItem'> | null = browserStorage(),
): void {
  if (!store || !did) return;
  try {
    store.removeItem(KEY_PREFIX + did);
  } catch {
    // Storage blocked: nothing was remembered either.
  }
}

/** How long a "no old check" answer of the KYC server is trusted before it is asked again. */
export const LEGACY_LOOKUP_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * Whether the old KYC server must be asked if this person has an old check.
 * Not when one is already known to be in flight (the status poll covers it),
 * and not when the server answered recently that there is none.
 */
export function needsLegacyKycLookup(
  state: { inFlight: boolean; lastPolledAt?: number | null },
  now = Date.now(),
): boolean {
  if (state.inFlight) return false;
  const at = state.lastPolledAt;
  return !(typeof at === 'number' && at <= now && now - at < LEGACY_LOOKUP_MAX_AGE_MS);
}
