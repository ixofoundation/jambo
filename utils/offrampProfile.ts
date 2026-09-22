import { hasOfframpProfileEntry, readOfframpProfile, storeOfframpProfile } from '@utils/matrixCredential';

// Reuse the matrix client type the store/read functions expect, rather than
// re-importing it from matrix-js-sdk (whose named type export doesn't resolve
// cleanly in this project).
type MxClient = Parameters<typeof readOfframpProfile>[0];

/**
 * Remembered off-ramp form fields — the values the user typed last time
 * (payout bank + account + any contact/identity fields they entered manually).
 *
 * This is convenience data the user can override, stored encrypted in their
 * matrix room (see `storeOfframpProfile`). It's applied on the next visit as
 * *editable* prefill, and is always lower priority than the verified KYC prefill
 * (which locks its fields) — so KYC-locked fields are never persisted here.
 */
export interface OfframpProfile {
  /** Payout country (ISO alpha-2). */
  country?: string;
  /** Payout rail the user chose last time ('bank' | 'momo'). */
  payoutMethod?: string;
  /** Selected network id (bank or mobile-money provider). */
  networkId?: string;
  /** Selected network display name (bank or mobile-money provider). */
  bankName?: string;
  /** Bank account number (bank rail) or mobile-money number digits (momo rail). */
  accountNumber?: string;
  accountName?: string;
  /** Contact / identity fields — only persisted when not locked by KYC. */
  name?: string;
  phone?: string;
  email?: string;
  /** YYYY-MM-DD. */
  dob?: string;
  /** Sender nationality (ISO alpha-2). */
  nationality?: string;
  idType?: string;
  idNumber?: string;
  bvn?: string;
  /** On-ramp (deposit) fields — same store, separate keys so the two flows
   *  never overwrite each other's rail/provider choices. */
  onrampCountry?: string;
  onrampMethod?: string;
  onrampNetworkId?: string;
  onrampProviderName?: string;
  /** Momo number the user pays FROM (digits, international format). */
  onrampMomoNumber?: string;
}

/** Best-effort read of the saved profile; null on absence / decryption failure. */
export async function loadOfframpProfile(mxClient: MxClient, roomId: string): Promise<OfframpProfile | null> {
  try {
    const raw = await readOfframpProfile(mxClient, roomId);
    return raw ? (raw as OfframpProfile) : null;
  } catch {
    return null;
  }
}

/**
 * `loadOfframpProfile`, but tolerant of the matrix client still syncing — the
 * same problem `waitForKycCredential` solves for the credential index. The
 * profile's index lives in room STATE, which may not be loaded yet right after
 * login, so a one-shot read at that moment would silently drop a returning
 * user's remembered details. Polls the cheap, synchronous index check and reads
 * (fetch + decrypt) exactly once, as soon as an entry appears. Resolves null
 * when no profile shows up within the window, when it can't be decrypted, or
 * when cancelled.
 */
export async function waitForOfframpProfile(
  mxClient: MxClient,
  roomId: string,
  opts: { timeoutMs?: number; pollIntervalMs?: number; cancelled?: () => boolean } = {},
): Promise<OfframpProfile | null> {
  const timeoutMs = opts.timeoutMs ?? 15000;
  const pollIntervalMs = opts.pollIntervalMs ?? 500;
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (opts.cancelled?.()) return null;
    if (hasOfframpProfileEntry(mxClient, roomId)) return loadOfframpProfile(mxClient, roomId);
    if (Date.now() >= deadline) return null;
    await new Promise((r) => setTimeout(r, pollIntervalMs));
  }
}

/**
 * Best-effort save of the profile — drops empty values, no-ops on an empty
 * payload, and never throws (e.g. when the room's encryption isn't ready). Must
 * not block the withdrawal flow.
 */
export async function saveOfframpProfile(mxClient: MxClient, roomId: string, profile: OfframpProfile): Promise<void> {
  try {
    const clean: Record<string, string> = {};
    (Object.keys(profile) as (keyof OfframpProfile)[]).forEach((key) => {
      const value = profile[key];
      if (value !== undefined && value !== null && String(value).trim() !== '') {
        clean[key] = String(value).trim();
      }
    });
    if (Object.keys(clean).length === 0) return;
    await storeOfframpProfile({ mxClient, roomId, profile: clean });
  } catch {
    /* best-effort — never block on persistence */
  }
}
