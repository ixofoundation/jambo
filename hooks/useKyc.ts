import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { BackgroundSetupContext } from '@contexts/backgroundSetup';
import { useAuth } from '@hooks/useAuth';
import { findSelfCredential } from '@utils/kyc/hubCredentials';
import { isKycVerified, resolveKycStatus } from '@utils/kyc/status';
import { hasKycCredential, waitForKycCredential } from '@utils/kycPrefill';
import { clearPendingSelfLink, loadPendingSelfLink } from '@utils/self/pendingLink';
import type { KycSource, KycState, KycStatus } from 'types/kyc';

type Resolved = { status: KycStatus; source: KycSource | null };
type MxClient = Parameters<typeof hasKycCredential>[0];

/**
 * How long a status read waits for the Vault to come up. Setup can stay idle
 * (no Matrix session to start from) or take long; past this the Vault counts
 * as not read, so the answer comes from the Auth Hub, or is "couldn't check"
 * with a retry, instead of "Checking…" without end.
 */
const VAULT_WAIT_MS = 20_000;

class VaultWaitTimeout extends Error {}

/** `promise`, or a `VaultWaitTimeout` rejection after `ms`. The timer never outlives the race. */
async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new VaultWaitTimeout()), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

const CHECKING: Resolved = { status: 'checking', source: null };
const SIGNED_OUT: Resolved = { status: 'none', source: null };

/**
 * The credential index is room state. A loaded room already has its state
 * (the sync injects it before the room is stored), so one read is enough;
 * until then, wait out the sync as the ramps do, or a legacy person would
 * briefly read as unverified.
 */
async function readLegacyCredential(mxClient: MxClient, roomId: string, cancelled: () => boolean): Promise<boolean> {
  if (mxClient.getRoom(roomId)) return hasKycCredential(mxClient, roomId);
  const found = await waitForKycCredential(mxClient, roomId, { cancelled });
  // The room never loaded: nothing was read, so "no credential" is not an answer.
  if (!found && !cancelled() && !mxClient.getRoom(roomId)) throw new Error('Vault room not loaded');
  return found;
}

/**
 * The one "is this person verified" state (docs/self-kyc-plan.md 4.1): the old
 * `kycamllevel1` credential in Matrix, else the Self credential in the Auth
 * Hub wallet. It does not poll; call `refresh()` when something may have changed.
 */
export function useKyc(): KycState {
  const { did, matrixRoomId, isLoading } = useAuth();
  const { getMatrixClient, awaitCompletion } = useContext(BackgroundSetupContext);
  const [resolved, setResolved] = useState<Resolved>(CHECKING);
  // Each run takes a number; only the latest may set state (also guards unmount).
  const latestRun = useRef(0);
  const rerun = useRef<() => void>(() => undefined);

  const run = useCallback(
    async (force: boolean) => {
      const runId = ++latestRun.current;
      const stale = () => latestRun.current !== runId;
      if (isLoading) return;
      if (!did) {
        setResolved(SIGNED_OUT);
        return;
      }

      let hasLegacyCredential = false;
      let matrixFailed = false;
      if (matrixRoomId) {
        try {
          // Quiet: reading the status must not raise the "setting up" overlay.
          const vaultReady = awaitCompletion({ quiet: true });
          try {
            await withTimeout(vaultReady, VAULT_WAIT_MS);
          } catch (error) {
            // The Vault was only slow: read again when it does come up, unless a newer read has started.
            if (error instanceof VaultWaitTimeout) {
              vaultReady.then(
                () => {
                  if (!stale()) rerun.current();
                },
                () => undefined,
              );
            }
            throw error;
          }
          const mxClient = getMatrixClient();
          if (!mxClient) throw new Error('Vault client not available');
          hasLegacyCredential = await readLegacyCredential(mxClient, matrixRoomId, stale);
        } catch {
          matrixFailed = true;
        }
        if (stale()) return;
      }

      // A legacy person never needs the Hub: no call, no audit row.
      let hasSelfCredential = false;
      let hubFailed = false;
      if (!hasLegacyCredential) {
        try {
          hasSelfCredential = !!(await findSelfCredential(did, { force }));
        } catch {
          hubFailed = true;
        }
        if (stale()) return;
        if (hasSelfCredential) clearPendingSelfLink(did);
      }

      setResolved(
        resolveKycStatus({
          hasLegacyCredential,
          matrixFailed,
          hasSelfCredential,
          hubFailed,
          hasPendingLink: !hasSelfCredential && !!loadPendingSelfLink(did),
        }),
      );
    },
    [did, matrixRoomId, isLoading, awaitCompletion, getMatrixClient],
  );

  rerun.current = () => void run(false);

  useEffect(() => {
    // Another account (or sign-out) must not keep showing the previous answer.
    setResolved(CHECKING);
    void run(false);
    const runs = latestRun;
    return () => {
      // Makes the run in flight stale: it must not set state after unmount.
      runs.current++;
    };
  }, [run]);

  // Keeps the answer on screen while re-checking, so a poll does not flicker.
  const refresh = useCallback(() => run(true), [run]);

  return useMemo(() => ({ ...resolved, verified: isKycVerified(resolved.status), refresh }), [resolved, refresh]);
}
