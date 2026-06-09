import { deriveRecoveryKeyFromPassphrase } from 'matrix-js-sdk/lib/crypto-api/key-passphrase';
import { calculateKeyCheck, trimTrailingEquals } from 'matrix-js-sdk/lib/secret-storage';

const secretStorageKeys = new Map();

/**
 * Security phrase for the active session, used to derive a secret-storage key on
 * demand when the cache misses. Registered by the encryption repair flow.
 *
 * Without this, `getSecretStorageKey` can only answer from the pre-primed cache,
 * which fails ("getSecretStorageKey callback returned falsey") whenever priming
 * silently did nothing — e.g. account data not yet synced when repair ran.
 */
// cspell:ignore falsey
let currentSecurityPhrase: string | null = null;

export function setSecurityPhrase(phrase: string | null) {
  currentSecurityPhrase = phrase;
}

export function storePrivateKey(keyId: string, privateKey: Uint8Array) {
  if (privateKey instanceof Uint8Array === false) {
    throw new Error('Unable to store, privateKey is invalid.');
  }

  secretStorageKeys.set(keyId, privateKey);
}

export function hasPrivateKey(keyId: string) {
  return secretStorageKeys.get(keyId) instanceof Uint8Array;
}

export function getPrivateKey(keyId: string) {
  return secretStorageKeys.get(keyId);
}

export function deletePrivateKey(keyId: string) {
  secretStorageKeys.delete(keyId);
}

export function clearSecretStorageKeys() {
  secretStorageKeys.clear();
  currentSecurityPhrase = null;
}

/** Validate a derived key against a key description's stored MAC/IV. When the
 *  description carries no `mac` we cannot validate, so accept the key (best effort). */
async function keyMatchesDescription(key: Uint8Array, info: any): Promise<boolean> {
  if (!info?.mac) return true;
  try {
    const { mac } = await calculateKeyCheck(key, info.iv);
    return trimTrailingEquals(info.mac) === trimTrailingEquals(mac);
  } catch (err) {
    console.warn('Secret storage key check failed:', err);
    return false;
  }
}

/** Try to derive a secret-storage key from the active security phrase for any of
 *  the requested key descriptions, validate it, cache it, and return the match. */
async function deriveSecretStorageKey(
  keys: Record<string, any>,
): Promise<[string, Uint8Array] | null> {
  if (!currentSecurityPhrase) return null;

  for (const [keyId, info] of Object.entries(keys)) {
    const pass = info?.passphrase;
    if (!pass?.salt || !pass?.iterations) continue;
    try {
      const keyBytes = await deriveRecoveryKeyFromPassphrase(
        currentSecurityPhrase,
        pass.salt,
        pass.iterations,
        pass.bits,
      );
      if (await keyMatchesDescription(keyBytes, info)) {
        secretStorageKeys.set(keyId, keyBytes);
        return [keyId, keyBytes];
      }
    } catch (err) {
      console.warn(`Failed to derive secret storage key ${keyId} from passphrase:`, err);
    }
  }
  return null;
}

export async function getSecretStorageKey({ keys }: { keys: any }): Promise<[string, Uint8Array] | null> {
  const keyIds = Object.keys(keys);
  const cachedKeyId = keyIds.find(hasPrivateKey);

  if (cachedKeyId) {
    return [cachedKeyId, getPrivateKey(cachedKeyId)];
  }

  // Cache miss: derive on demand from the active security phrase. This is the
  // resilient path — the SDK passes the exact key descriptions it needs here,
  // so we no longer depend on account data having been synced at prime time.
  const derived = await deriveSecretStorageKey(keys);
  if (derived) return derived;

  console.warn('[secretStorage] getSecretStorageKey: no cached or derivable key for', keyIds);
  return null;
}

export function cacheSecretStorageKey(keyId: string, _keyInfo: any, privateKey: Uint8Array) {
  secretStorageKeys.set(keyId, privateKey);
}
