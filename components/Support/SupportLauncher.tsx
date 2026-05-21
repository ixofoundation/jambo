import { useCallback, useEffect, useState } from 'react';

import { useSupportInit } from '@hooks/useSupportInit';
import { useSupportUnread } from '@hooks/useSupportUnread';
import {
  SupportLastSeen,
  markSupportDmSeen,
  markSupportThreadSeen,
} from 'lib/matrix/support';

import SupportIconButton from './SupportIconButton';
import SupportModal from './SupportModal';

type SupportLauncherProps = {
  entityDid: string;
};

const EMPTY_LAST_SEEN: SupportLastSeen = { threads: {}, dms: {} };

/**
 * Wraps the support icon button together with the data-loading + unread-detection lifecycle.
 *
 * - Runs `useSupportInit` on mount so the modal opens instantly when clicked. If the launcher is
 *   unmounted (user navigates away), the init hook unmounts too — no work wasted on pages that
 *   don't surface support.
 * - Computes per-conversation unread booleans and a global "any unread" via `useSupportUnread`.
 * - Persists per-thread / per-DM "seen" timestamps to the user's matrix room whenever the user
 *   enters or leaves that conversation's view inside the modal.
 */
export default function SupportLauncher({ entityDid }: SupportLauncherProps) {
  const init = useSupportInit(entityDid);
  const [open, setOpen] = useState(false);

  // Local mirror of the persisted last-seen maps. Initialised from init when ready, and updated
  // optimistically when the user opens/closes a conversation so dots react immediately without
  // waiting for the matrix round-trip.
  const [lastSeen, setLastSeen] = useState<SupportLastSeen>(EMPTY_LAST_SEEN);
  useEffect(() => {
    if (init.kind === 'ready') setLastSeen(init.initialLastSeen);
  }, [init]);

  const unread = useSupportUnread({
    mxClient: init.kind === 'ready' ? init.mxClient : null,
    supportRoomId: init.kind === 'ready' ? init.supportRoomId : '',
    ownerUserId: init.kind === 'ready' ? init.mxClient.getUserId() ?? '' : '',
    threads: init.kind === 'ready' ? init.initialThreads : EMPTY_THREADS,
    dmRooms: init.kind === 'ready' ? init.initialDmRooms : EMPTY_DMS,
    threadLastSeen: lastSeen.threads,
    dmLastSeen: lastSeen.dms,
  });

  const handleMarkThreadSeen = useCallback(
    (rootId: string) => {
      if (init.kind !== 'ready') return;
      const ts = Date.now();
      setLastSeen((prev) => ({
        threads: { ...prev.threads, [rootId]: Math.max(prev.threads[rootId] ?? 0, ts) },
        dms: prev.dms,
      }));
      void markSupportThreadSeen(init.mxClient, init.userRoomId, init.supportRoomId, rootId, ts).catch((err) =>
        console.warn('[SupportLauncher] failed to mark thread seen', err),
      );
    },
    [init],
  );

  const handleMarkDmSeen = useCallback(
    (dmRoomId: string) => {
      if (init.kind !== 'ready') return;
      const ts = Date.now();
      setLastSeen((prev) => ({
        threads: prev.threads,
        dms: { ...prev.dms, [dmRoomId]: Math.max(prev.dms[dmRoomId] ?? 0, ts) },
      }));
      void markSupportDmSeen(init.mxClient, init.userRoomId, init.supportRoomId, dmRoomId, ts).catch((err) =>
        console.warn('[SupportLauncher] failed to mark DM seen', err),
      );
    },
    [init],
  );

  const handleOpen = useCallback(() => setOpen(true), []);
  const handleClose = useCallback(() => setOpen(false), []);

  return (
    <>
      <SupportIconButton onClick={handleOpen} hasUnread={init.kind === 'ready' && unread.any} />
      {open && (
        <SupportModal
          init={init}
          onClose={handleClose}
          threadUnread={unread.threads}
          dmUnread={unread.dms}
          onMarkThreadSeen={handleMarkThreadSeen}
          onMarkDmSeen={handleMarkDmSeen}
        />
      )}
    </>
  );
}

// Stable empty references so the unread hook's deps don't churn while init is loading.
const EMPTY_THREADS: never[] = [];
const EMPTY_DMS: never[] = [];
