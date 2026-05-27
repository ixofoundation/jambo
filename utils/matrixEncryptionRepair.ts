import type { MatrixClient } from 'matrix-js-sdk';
import { deriveRecoveryKeyFromPassphrase } from 'matrix-js-sdk/lib/crypto-api/key-passphrase';

import {
  generatePasswordFromMnemonic,
  generateRecoveryPhraseFromMnemonic,
  getAuthId,
} from '@utils/matrix';
import { storePrivateKey } from '@utils/secretStorageKeys';

export interface MatrixEncryptionState {
  ready: boolean;
  crossSigningReady: boolean;
  secretStorageReady: boolean;
  keyBackupVersion: string | null;
}

export async function isMatrixEncryptionReady(mxClient: MatrixClient): Promise<MatrixEncryptionState> {
  const crypto = mxClient.getCrypto();
  if (!crypto) {
    return { ready: false, crossSigningReady: false, secretStorageReady: false, keyBackupVersion: null };
  }

  const [crossSigningReady, secretStorageReady, keyBackupVersion] = await Promise.all([
    crypto.isCrossSigningReady(),
    crypto.isSecretStorageReady(),
    crypto.getActiveSessionBackupVersion(),
  ]);

  return {
    ready: crossSigningReady && secretStorageReady && !!keyBackupVersion,
    crossSigningReady,
    secretStorageReady,
    keyBackupVersion,
  };
}

/**
 * If a default secret-storage key already exists on the account, derive the key bytes
 * from the security phrase and seed our in-memory cache so the matrix-js-sdk
 * `getSecretStorageKey` callback can return them when bootstrap re-runs.
 *
 * Without this, bootstrapping fails with "getSecretStorageKey callback returned falsey"
 * because the cache is empty on a fresh page load.
 */
async function primeExistingSecretStorageKey(mxClient: MatrixClient, securityPhrase: string): Promise<void> {
  const defaultKeyEvent = mxClient.getAccountData('m.secret_storage.default_key');
  const defaultKeyId = defaultKeyEvent?.getContent()?.key as string | undefined;
  if (!defaultKeyId) return;

  const keyInfoEvent = mxClient.getAccountData(`m.secret_storage.key.${defaultKeyId}`);
  const keyInfo = keyInfoEvent?.getContent() as
    | { passphrase?: { algorithm: string; salt: string; iterations: number; bits?: number } }
    | undefined;
  const pass = keyInfo?.passphrase;
  if (!pass?.salt || !pass?.iterations) return;

  try {
    const keyBytes = await deriveRecoveryKeyFromPassphrase(securityPhrase, pass.salt, pass.iterations, pass.bits);
    storePrivateKey(defaultKeyId, keyBytes);
  } catch (err) {
    console.warn('Failed to derive existing secret storage key from passphrase:', err);
  }
}

/**
 * After a backup version exists server-side the local engine may not have picked it up yet.
 * Force a recheck and poll briefly until the active session backup version is reported.
 */
async function waitForActiveKeyBackup(mxClient: MatrixClient, timeoutMs = 4000): Promise<string | null> {
  const crypto = mxClient.getCrypto();
  if (!crypto) return null;

  const deadline = Date.now() + timeoutMs;
  let version: string | null = null;
  while (Date.now() < deadline) {
    try {
      await crypto.checkKeyBackupAndEnable();
    } catch (err) {
      console.warn('checkKeyBackupAndEnable failed:', err);
    }
    version = await crypto.getActiveSessionBackupVersion();
    if (version) return version;
    await new Promise((r) => setTimeout(r, 250));
  }
  return version;
}

/**
 * Non-destructive repair: only creates what's missing, never resets existing keys/backups.
 *
 * - Secret storage: `setupNewSecretStorage: false` preserves any existing default key. The
 *   `createSecretStorageKey` callback is only invoked when no default key exists.
 * - Cross-signing: `setupNewCrossSigning: false` preserves existing master/self/user keys.
 *   bootstrapCrossSigning is a no-op when keys are already present and trusted.
 * - Key backup: only call `resetKeyBackup()` when no backup version exists on the server.
 *   If a backup already exists, we enable it locally via `checkKeyBackupAndEnable()` so
 *   the running session uploads to (and decrypts from) the existing version — preserving
 *   any keys that were already backed up.
 */
export async function repairMatrixEncryption(mxClient: MatrixClient, mnemonic: string): Promise<void> {
  const crypto = mxClient.getCrypto();
  if (!crypto) throw new Error('Crypto API unavailable');

  const password = generatePasswordFromMnemonic(mnemonic);
  const securityPhrase = generateRecoveryPhraseFromMnemonic(mnemonic);

  await primeExistingSecretStorageKey(mxClient, securityPhrase);

  // Before any bootstrap, force the device to finish its initial `/keys/query` so
  // the user's cross-signing public identity is loaded. Without this, on a fresh
  // device the client reaches `PREPARED` (initial sync done) before /keys/query
  // returns, and `bootstrapCrossSigning` fails with
  //   "the signing key is missing from the object that signed the message" /
  //   "No public identity found while importing cross-signing keys"
  // because there's nothing to verify the existing signatures against.
  try {
    const userId = mxClient.getUserId();
    if (userId) {
      await crypto.userHasCrossSigningKeys(userId, true);
    }
  } catch (err) {
    console.warn('userHasCrossSigningKeys pre-flight failed:', err);
  }

  // Each phase is isolated so a transient verification failure in one (e.g. stale
  // device signatures during cross-signing verification on a fresh device) doesn't
  // abort the whole repair. The final readiness check decides success/failure.

  // Phase 1: secret storage. Preserves existing default key; createSecretStorageKey
  // only fires when no default key exists on the account.
  try {
    const recoveryKey = await crypto.createRecoveryKeyFromPassphrase(securityPhrase);
    await crypto.bootstrapSecretStorage({
      createSecretStorageKey: async () => recoveryKey!,
      setupNewSecretStorage: false,
    });
  } catch (err) {
    console.warn('bootstrapSecretStorage failed:', err);
  }

  // Phase 2: cross-signing. Preserves existing keys. No-op when already healthy.
  // Failures here (often "signing key is missing from the object that signed the
  // message" when stale device signatures exist) are surfaced via the final check.
  try {
    const userId = mxClient.getUserId()!;
    await crypto.bootstrapCrossSigning({
      authUploadDeviceSigningKeys: async (makeRequest) => {
        await makeRequest(getAuthId({ userId, password }));
      },
      setupNewCrossSigning: false,
    });
  } catch (err) {
    console.warn('bootstrapCrossSigning failed:', err);
  }

  // Phase 3: key backup. Non-destructive — only create a new version when none exists.
  try {
    const existingBackup = await crypto.getKeyBackupInfo();
    if (existingBackup) {
      // Pull the megolm backup decryption key from secret storage into the local
      // crypto store. Without this `restoreKeyBackup` fails with
      // "No decryption key found in crypto store" — the key only lives on the server
      // (encrypted with our secret-storage key) until this method runs.
      try {
        await crypto.loadSessionBackupPrivateKeyFromSecretStorage();
      } catch (err) {
        console.warn('loadSessionBackupPrivateKeyFromSecretStorage failed:', err);
      }
      try {
        await crypto.checkKeyBackupAndEnable();
      } catch (err) {
        console.warn('checkKeyBackupAndEnable failed:', err);
      }
      // Best-effort: import historical room keys. Failures here are common when the
      // backup contains keys signed by a device that no longer exists — non-fatal.
      try {
        await crypto.restoreKeyBackup();
      } catch (err) {
        console.warn('restoreKeyBackup (existing) failed:', err);
      }
    } else {
      await crypto.resetKeyBackup();
    }
  } catch (err) {
    console.warn('Key backup setup failed:', err);
  }

  await waitForActiveKeyBackup(mxClient);

  const after = await isMatrixEncryptionReady(mxClient);
  if (!after.ready) {
    throw new Error(
      `Matrix encryption setup incomplete: crossSigning=${after.crossSigningReady} secretStorage=${after.secretStorageReady} keyBackup=${after.keyBackupVersion ?? 'none'}`,
    );
  }
}
