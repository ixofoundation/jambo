import type { MatrixClient } from 'matrix-js-sdk';
import type { StartDehydrationOpts } from 'matrix-js-sdk/lib/crypto-api';

/**
 * MSC3814 dehydrated devices.
 *
 * Keeps a server-side "spare" device that receives room keys while the user has no live
 * session. On the next login the SDK rehydrates it, imports the queued keys into this
 * device and lets key backup pick them up, so history written while every real device was
 * closed stays readable.
 *
 * Best-effort and never throws: a no-op when the homeserver has MSC3814 disabled, or when
 * cross-signing / secret storage are not ready (the SDK refuses to dehydrate without them).
 *
 * - After a login or encryption repair, call with default opts: rehydrates any existing
 *   device first, then creates a dehydration key in secret storage if none exists.
 * - On a plain reattach of an existing session, call with
 *   `{ onlyIfKeyCached: true, rehydrate: false }`: keeps the weekly rotation running
 *   without touching secret storage (the key cache lives in the crypto store).
 *
 * Returns true when dehydration was started.
 */
export async function initialiseDehydrationIfEnabled(
  mxClient: MatrixClient,
  opts: StartDehydrationOpts = {},
): Promise<boolean> {
  const crypto = mxClient.getCrypto();
  if (!crypto) return false;

  try {
    if (!(await crypto.isDehydrationSupported())) {
      console.info('[dehydration] not supported by the homeserver, skipping');
      return false;
    }
    const [crossSigningReady, secretStorageReady] = await Promise.all([
      crypto.isCrossSigningReady(),
      crypto.isSecretStorageReady(),
    ]);
    if (!crossSigningReady || !secretStorageReady) {
      console.info(`[dehydration] skipped: crossSigning=${crossSigningReady} secretStorage=${secretStorageReady}`);
      return false;
    }
    await crypto.startDehydration(opts);
    console.info('[dehydration] started', opts);
    return true;
  } catch (err) {
    console.warn('[dehydration] failed (non-fatal):', err);
    return false;
  }
}
