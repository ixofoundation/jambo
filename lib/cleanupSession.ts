/**
 * The youth app's session record — written by Jambo, read by /cleanup.
 *
 * The World Cleanup Day youth app is served under this domain at /cleanup
 * (see next.config.js). It keeps no login of its own there: it reads ONE
 * record from localStorage, `qi.session`, and treats whoever it names as
 * signed in. Jambo owns that record on this origin — written whenever a
 * session is established or revived, removed whenever one ends — so one
 * sign-in here is a sign-in there, and one sign-out ends both.
 *
 * The shape is the youth app's (`QiSession` in openhands-network,
 * packages/openhands-chain/src/session.ts). Only the fields it acts on are
 * written: the address, the DID, the display name, and the hub session key
 * with the id of the authenticator the hub registered it as — the same key
 * Jambo signs with. Without both halves of the key the record still names
 * the person, and the youth app treats it as "can read, cannot act".
 *
 * Plain JSON, deliberately: the youth app has no way to read Jambo's
 * encrypted store, and the encryption there is under a constant in this
 * bundle — the origin is the boundary for both apps, not the cipher.
 */

const KEY = 'qi.session';

export interface CleanupSessionInput {
  address: string;
  did: string;
  displayName: string | null;
  sessionMnemonic: string | null;
  sessionAuthenticatorId: string | null;
}

export function writeCleanupSession(data: CleanupSessionInput): void {
  if (typeof window === 'undefined') return;
  const record: Record<string, unknown> = { address: data.address, kind: 'authhub', did: data.did };
  if (data.displayName) record.name = data.displayName;
  if (data.sessionMnemonic && data.sessionAuthenticatorId) {
    record.sessionKey = { mnemonic: data.sessionMnemonic, authenticatorId: data.sessionAuthenticatorId };
  }
  try {
    window.localStorage.setItem(KEY, JSON.stringify(record));
  } catch {
    // Storage unavailable (private mode etc.) — the youth app simply sees nobody.
  }
}

export function clearCleanupSession(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
}
