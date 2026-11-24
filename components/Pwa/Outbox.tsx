import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { toast } from 'react-toastify';
import { createMatrixClaimBotClient } from '@ixo/matrixclient-sdk';

import { ClockIcon } from '@components/Icons/icons';
import { useAuth } from '@hooks/useAuth';
import { useBackgroundSetup } from '@hooks/useBackgroundSetup';
import { secret } from '@utils/secrets';
import {
  type QueuedClaim,
  type SendDeps,
  discardQueuedClaim,
  getOutboxState,
  getServerOutboxState,
  refreshOutbox,
  sendQueuedClaims,
  subscribeOutbox,
} from 'lib/pwa/outbox/claims';
import { findHeldFileIds } from 'lib/pwa/outbox/heldFiles';
import { formatSavedAt } from 'lib/pwa/userData';

// While claims wait and the phone says it is online, try again this often.
const RETRY_MS = 2 * 60 * 1000;
// How long to wait for the Matrix login (Claim Bot needs it) before giving up for this round.
const DATA_STORE_WAIT_MS = 60 * 1000;

function useOutbox() {
  return useSyncExternalStore(subscribeOutbox, getOutboxState, getServerOutboxState);
}

/** Sends this account's queued claims; does nothing when signed out. */
function useSend(): () => Promise<void> {
  const { address, did, onSign } = useAuth();
  const { awaitCompletion } = useBackgroundSetup();

  return useCallback(async () => {
    if (!address || !did) return;
    const deps: SendDeps = {
      address,
      did,
      onSign,
      // Quiet: never raise the setup overlay for a send the user didn't start.
      waitForDataStore: () =>
        Promise.race([
          awaitCompletion({ quiet: true }),
          new Promise<void>((_, reject) =>
            setTimeout(() => reject(new Error('Your data store is still starting. Try again in a moment.')), DATA_STORE_WAIT_MS),
          ),
        ]),
      claimBot: () => {
        const token = secret.accessToken as string | undefined;
        if (!token) return null;
        return createMatrixClaimBotClient({
          homeServerUrl: process.env.NEXT_PUBLIC_MATRIX_HOMESERVER_URL!,
          botUrl: process.env.NEXT_PUBLIC_MATRIX_CLAIM_BOT_URL!,
          accessToken: token,
        }) as any;
      },
    };
    const { sent } = await sendQueuedClaims(deps);
    if (sent.length === 1) toast.success(`Your claim "${sent[0].title}" was sent.`);
    else if (sent.length > 1) toast.success(`${sent.length} claims were sent.`);
  }, [address, did, onSign, awaitCompletion]);
}

/**
 * Mounted once (components/Pwa): sends queued claims when it can. On sign-in,
 * when the connection returns, when the app comes back to the front, when a
 * claim is queued while online, and every 2 minutes while any are waiting.
 */
export function OutboxRunner() {
  const { isLoggedIn, address } = useAuth();
  const { claims } = useOutbox();
  const send = useSend();
  const mine = claims.filter((c) => c.address === address).length;

  useEffect(() => {
    if (isLoggedIn) refreshOutbox().catch(() => undefined);
  }, [isLoggedIn, address]);

  const trySend = useCallback(() => {
    if (!isLoggedIn || navigator.onLine === false) return;
    if (!getOutboxState().claims.some((c) => c.address === address)) return;
    send().catch((err) => console.warn('[outbox] send failed:', err));
  }, [isLoggedIn, address, send]);

  // A new claim queued while online, or the first load after sign-in.
  useEffect(() => {
    if (mine > 0) trySend();
  }, [mine, trySend]);

  useEffect(() => {
    if (!isLoggedIn) return;
    const onVisible = () => document.visibilityState === 'visible' && trySend();
    window.addEventListener('online', trySend);
    document.addEventListener('visibilitychange', onVisible);
    const timer = window.setInterval(trySend, RETRY_MS);
    return () => {
      window.removeEventListener('online', trySend);
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(timer);
    };
  }, [isLoggedIn, trySend]);

  return null;
}

/**
 * "Waiting to send" list: this account's queued claims, optionally only one
 * collection's. Shown on Tasks and on the collection page.
 */
export function WaitingClaims({ collectionId }: { collectionId?: string }) {
  const { address } = useAuth();
  const { claims, sending } = useOutbox();
  const send = useSend();
  const [online, setOnline] = useState(true);
  const [confirming, setConfirming] = useState<string | null>(null);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine !== false);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  const mine = claims.filter((c) => c.address === address && (!collectionId || c.collectionId === collectionId));
  if (mine.length === 0) return null;

  const status = (claim: QueuedClaim) => {
    if (sending) return 'Sending…';
    if (claim.awaitingConfirmation) return 'Sent. Waiting for the chain to confirm it';
    if (!online) return 'Sends when you are back online';
    if (claim.lastError) return `Not sent: ${claim.lastError}`;
    return 'Waiting to send';
  };

  return (
    <section aria-label='Claims waiting to send' style={{ marginBottom: 16 }}>
      <div className='section-header' style={{ marginTop: 4 }}>
        <h2>Waiting to send</h2>
      </div>
      {mine.map((claim) => {
        const photos = findHeldFileIds(claim.surveyData).length - Object.keys(claim.uploaded ?? {}).length;
        return (
          <div key={claim.id} className='status-item' style={{ marginBottom: 10, alignItems: 'flex-start' }}>
            <span className='notif-ic' style={{ background: 'var(--purple-tint)', color: 'var(--purple-primary)' }}>
              <ClockIcon size={20} />
            </span>
            <div className='status-item__body'>
              <div className='status-item__title'>{claim.title}</div>
              <div className='status-item__meta'>
                Saved {formatSavedAt(claim.createdAt)}
                {photos > 0 ? ` · ${photos} photo${photos === 1 ? '' : 's'} to upload` : ''}
              </div>
              <div
                className='status-item__meta'
                style={{ color: claim.lastError && !sending ? 'var(--error-color)' : undefined }}
              >
                {status(claim)}
              </div>
              <div style={{ display: 'flex', gap: 14, marginTop: 8 }}>
                <button
                  type='button'
                  disabled={sending || !online}
                  onClick={() => send().catch(() => undefined)}
                  style={linkStyle(sending || !online)}
                >
                  Send now
                </button>
                {confirming === claim.id ? (
                  <button
                    type='button'
                    style={{ ...linkStyle(sending), color: 'var(--error-color)' }}
                    disabled={sending}
                    onClick={() => {
                      setConfirming(null);
                      discardQueuedClaim(claim).catch(() => toast.error('Could not delete the claim.'));
                    }}
                  >
                    Yes, delete it
                  </button>
                ) : (
                  <button
                    type='button'
                    style={linkStyle(sending)}
                    disabled={sending}
                    onClick={() => setConfirming(claim.id)}
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </section>
  );
}

function linkStyle(disabled: boolean) {
  return {
    minHeight: 32,
    padding: 0,
    border: 0,
    background: 'none',
    color: 'var(--green-primary)',
    font: 'inherit',
    fontWeight: 700,
    fontSize: 14,
    cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.45 : 1,
  } as const;
}
