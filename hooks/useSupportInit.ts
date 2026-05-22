import { useEffect, useState } from 'react';
import type { MatrixClient } from 'matrix-js-sdk';

import { useAuth } from '@hooks/useAuth';
import { useBackgroundSetup } from '@hooks/useBackgroundSetup';
import {
  SupportDmRoom,
  SupportLastSeen,
  SupportRoomNotProvisionedError,
  SupportThreadEntry,
  buildSupportRoomAlias,
  ensureJoined,
  fetchSupportAdminUserIds,
  fetchSupportThreadSummaries,
  findJoinedDmsWithAdmins,
  findPendingDmInvitesFromAdmins,
  readSupportLastSeen,
  readSupportThreadIds,
  removeSupportThreadId,
  resolveSupportRoom,
} from 'lib/matrix/support';

export type SupportInitStatus =
  | { kind: 'loading' }
  | {
      kind: 'ready';
      mxClient: MatrixClient;
      supportRoomId: string;
      userRoomId: string;
      initialThreads: SupportThreadEntry[];
      initialDmRooms: SupportDmRoom[];
      /** Pending DM invites from support admins; not auto-accepted. */
      initialDmInvites: SupportDmRoom[];
      initialLastSeen: SupportLastSeen;
      adminUserIds: Set<string>;
    }
  | { kind: 'error'; message: string };

/**
 * Encapsulates the full support-modal init flow:
 *  - wait for the Matrix background setup to be ready
 *  - resolve the entity's support room alias
 *  - join the room (idempotent)
 *  - hydrate the user's persisted thread ids → displayable summaries
 *  - silently prune ids that no longer resolve
 *  - discover support-room admins and auto-accept any pending DM invites from them
 *  - list joined 1:1 DMs with those admins
 *
 * Re-runs only when `entityDid` changes (or the user's room id becomes available).
 */
export function useSupportInit(entityDid: string): SupportInitStatus {
  const auth = useAuth();
  const { awaitCompletion, getMatrixClient } = useBackgroundSetup();
  const userRoomId = auth.matrixRoomId;
  const [status, setStatus] = useState<SupportInitStatus>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    setStatus({ kind: 'loading' });

    (async () => {
      try {
        await awaitCompletion();
        if (cancelled) return;

        const mxClient = getMatrixClient();
        if (!mxClient) {
          setStatus({ kind: 'error', message: 'Could not connect to the Data Store. Please try again.' });
          return;
        }

        const homeserverName = mxClient.getDomain();
        if (!homeserverName) {
          setStatus({ kind: 'error', message: 'Matrix homeserver is not configured.' });
          return;
        }

        if (!userRoomId) {
          setStatus({
            kind: 'error',
            message: 'Your personal data room is not ready yet. Please retry shortly.',
          });
          return;
        }

        const alias = buildSupportRoomAlias(entityDid, homeserverName);
        const { roomId } = await resolveSupportRoom(mxClient, alias);
        await ensureJoined(mxClient, roomId);
        if (cancelled) return;

        const storedIds = await readSupportThreadIds(mxClient, userRoomId, roomId);
        if (cancelled) return;
        const { entries, missingIds } = await fetchSupportThreadSummaries(mxClient, roomId, storedIds);
        if (cancelled) return;

        // Best-effort: prune root IDs that no longer resolve (e.g. redacted) so the list doesn't
        // accumulate dead pointers. Non-blocking — failures here just mean we'll try again next time.
        for (const id of missingIds) {
          void removeSupportThreadId(mxClient, userRoomId, roomId, id).catch(() => undefined);
        }

        // DM discovery: find support-room admins, surface any joined DMs, and list any pending
        // invites from those admins (the user must explicitly approve before joining).
        const adminIds = await fetchSupportAdminUserIds(mxClient, roomId);
        if (cancelled) return;
        const dms = findJoinedDmsWithAdmins(mxClient, adminIds);
        const invites = findPendingDmInvitesFromAdmins(mxClient, adminIds);
        if (cancelled) return;

        const lastSeen = await readSupportLastSeen(mxClient, userRoomId, roomId);
        if (cancelled) return;

        setStatus({
          kind: 'ready',
          mxClient,
          supportRoomId: roomId,
          userRoomId,
          initialThreads: entries,
          initialDmRooms: dms,
          initialDmInvites: invites,
          initialLastSeen: lastSeen,
          adminUserIds: adminIds,
        });
      } catch (err) {
        if (cancelled) return;
        if (err instanceof SupportRoomNotProvisionedError) {
          setStatus({
            kind: 'error',
            message: 'A support room for this entity has not been provisioned yet. Please try again later.',
          });
          return;
        }
        const message = err instanceof Error ? err.message : 'Unable to load support room.';
        console.error('[useSupportInit] failed', err);
        setStatus({ kind: 'error', message });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [awaitCompletion, entityDid, getMatrixClient, userRoomId]);

  return status;
}
