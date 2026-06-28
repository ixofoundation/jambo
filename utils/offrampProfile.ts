import { readOfframpProfile, storeOfframpProfile } from '@utils/matrixCredential';

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
  /** Selected bank network id. */
  networkId?: string;
  /** Selected bank display name. */
  bankName?: string;
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
