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

export interface PhaseDiagnostic {
  phase: string;
  step?: string;
  error: string;
  name?: string;
  stack?: string;
}

export interface MatrixEncryptionDiagnostics {
  stage?: 'login' | 'reattach' | 'recovery';
  timestamp: string;
  userId: string | null;
  deviceId: string | null;
  stateBefore: MatrixEncryptionState | null;
  stateAfter: MatrixEncryptionState;
  phaseErrors: PhaseDiagnostic[];
}

/** Error thrown when encryption setup is left incomplete. Carries the per-phase
 *  failures and surrounding state so the UI can render a detailed report. */
export class MatrixEncryptionError extends Error {
  diagnostics: MatrixEncryptionDiagnostics;

  constructor(message: string, diagnostics: MatrixEncryptionDiagnostics) {
    super(message);
    this.name = 'MatrixEncryptionError';
    this.diagnostics = diagnostics;
  }
}

/** Normalize any thrown value into a `PhaseDiagnostic`. */
function toPhaseDiagnostic(phase: string, step: string | undefined, err: unknown): PhaseDiagnostic {
  if (err instanceof Error) {
    return { phase, step, error: err.message, name: err.name, stack: err.stack };
  }
  return { phase, step, error: typeof err === 'string' ? err : JSON.stringify(err) };
}

/** Render a human-readable multi-line diagnostics report from any caught error.
 *  Produces the full per-phase breakdown for a `MatrixEncryptionError`, and
 *  degrades gracefully (stage + timestamp + message + stack) for any other error. */
export function formatEncryptionDiagnostics(
  err: unknown,
  extra?: { stage?: MatrixEncryptionDiagnostics['stage'] },
): string {
  const lines: string[] = [];
  const fmtState = (s: MatrixEncryptionState | null): string =>
    s
      ? `crossSigning=${s.crossSigningReady} secretStorage=${s.secretStorageReady} keyBackup=${s.keyBackupVersion ?? 'none'}`
      : 'unknown';

  if (err instanceof MatrixEncryptionError) {
    const d = err.diagnostics;
    lines.push(`Stage: ${extra?.stage ?? d.stage ?? 'unknown'}`);
    lines.push(`Time: ${d.timestamp}`);
    lines.push(`User: ${d.userId ?? 'unknown'}`);
    lines.push(`Device: ${d.deviceId ?? 'unknown'}`);
    lines.push(`State before: ${fmtState(d.stateBefore)}`);
    lines.push(`State after: ${fmtState(d.stateAfter)}`);
    lines.push('');
    lines.push(`Summary: ${err.message}`);
    if (d.phaseErrors.length) {
      lines.push('');
      lines.push(`Phase errors (${d.phaseErrors.length}):`);
      d.phaseErrors.forEach((p, i) => {
        const where = p.step ? `${p.phase} › ${p.step}` : p.phase;
        lines.push(`  ${i + 1}. [${where}] ${p.name ? p.name + ': ' : ''}${p.error}`);
        if (p.stack) {
          p.stack
            .split('\n')
            .slice(0, 6)
            .forEach((sl) => lines.push(`       ${sl.trim()}`));
        }
      });
    } else {
      lines.push('');
      lines.push('No individual phase threw — bootstrap calls succeeded but the');
      lines.push('final readiness check still reported incomplete encryption.');
    }
    return lines.join('\n');
  }

  // Generic error (login failure, mnemonic fetch failure, recovery cancelled, etc.)
  lines.push(`Stage: ${extra?.stage ?? 'unknown'}`);
  lines.push(`Time: ${new Date().toISOString()}`);
  if (err instanceof Error) {
    lines.push(`Error: ${err.name}: ${err.message}`);
    if (err.stack) {
      lines.push('');
      lines.push('Stack:');
      err.stack
        .split('\n')
        .slice(0, 10)
        .forEach((sl) => lines.push(`  ${sl.trim()}`));
    }
  } else {
    lines.push(`Error: ${typeof err === 'string' ? err : JSON.stringify(err)}`);
  }
  return lines.join('\n');
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
async function waitForActiveKeyBackup(
  mxClient: MatrixClient,
  phaseErrors?: PhaseDiagnostic[],
  timeoutMs = 4000,
): Promise<string | null> {
  const crypto = mxClient.getCrypto();
  if (!crypto) return null;

  const deadline = Date.now() + timeoutMs;
  let version: string | null = null;
  while (Date.now() < deadline) {
    try {
      await crypto.checkKeyBackupAndEnable();
    } catch (err) {
      console.warn('checkKeyBackupAndEnable failed:', err);
      phaseErrors?.push(toPhaseDiagnostic('key-backup', 'waitForActiveKeyBackup/checkKeyBackupAndEnable', err));
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

  // Collect every per-phase failure so an incomplete result can be diagnosed
  // remotely. Phases stay isolated (best-effort), but the errors are no longer lost.
  const phaseErrors: PhaseDiagnostic[] = [];
  const record = (phase: string, step: string | undefined, err: unknown) => {
    phaseErrors.push(toPhaseDiagnostic(phase, step, err));
  };

  const stateBefore = await isMatrixEncryptionReady(mxClient).catch(() => null);

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
    record('pre-flight', 'userHasCrossSigningKeys', err);
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
    record('secret-storage', 'bootstrapSecretStorage', err);
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
    record('cross-signing', 'bootstrapCrossSigning', err);
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
        record('key-backup', 'loadSessionBackupPrivateKeyFromSecretStorage', err);
      }
      try {
        await crypto.checkKeyBackupAndEnable();
      } catch (err) {
        console.warn('checkKeyBackupAndEnable failed:', err);
        record('key-backup', 'checkKeyBackupAndEnable', err);
      }
      // Best-effort: import historical room keys. Failures here are common when the
      // backup contains keys signed by a device that no longer exists — non-fatal.
      try {
        await crypto.restoreKeyBackup();
      } catch (err) {
        console.warn('restoreKeyBackup (existing) failed:', err);
        record('key-backup', 'restoreKeyBackup', err);
      }
    } else {
      await crypto.resetKeyBackup();
    }
  } catch (err) {
    console.warn('Key backup setup failed:', err);
    record('key-backup', 'resetKeyBackup/getKeyBackupInfo', err);
  }

  await waitForActiveKeyBackup(mxClient, phaseErrors);

  const after = await isMatrixEncryptionReady(mxClient);
  if (!after.ready) {
    throw new MatrixEncryptionError(
      `Matrix encryption setup incomplete: crossSigning=${after.crossSigningReady} secretStorage=${after.secretStorageReady} keyBackup=${after.keyBackupVersion ?? 'none'}`,
      {
        timestamp: new Date().toISOString(),
        userId: mxClient.getUserId(),
        deviceId: mxClient.getDeviceId(),
        stateBefore,
        stateAfter: after,
        phaseErrors,
      },
    );
  }
}
