import { useCallback } from 'react';
import { useRouter } from 'next/router';

import { useSupportInit } from '@hooks/useSupportInit';
import { useSupportUnread } from '@hooks/useSupportUnread';

import SupportIconButton from './SupportIconButton';

type SupportLauncherProps = {
  entityDid: string;
  /** Which curated quick-message set to surface on the support screen (via `?prompts=`). */
  promptsKey?: string;
};

/**
 * Renders the support icon button on a host surface (e.g. the KYC card).
 *
 * - Runs `useSupportInit` so the unread red dot reflects matrix state without waiting for the user
 *   to enter the support screen. Init unmounts naturally when the host page does, so other pages
 *   pay no cost.
 * - Clicking navigates to `/profile/support/[entityDid]?prompts=<key>`. The full conversation UI
 *   lives on that route; this component owns no modal state.
 */
export default function SupportLauncher({ entityDid, promptsKey = 'kyc' }: SupportLauncherProps) {
  const router = useRouter();
  const init = useSupportInit(entityDid);

  const unread = useSupportUnread({
    mxClient: init.kind === 'ready' ? init.mxClient : null,
    supportRoomId: init.kind === 'ready' ? init.supportRoomId : '',
    ownerUserId: init.kind === 'ready' ? init.mxClient.getUserId() ?? '' : '',
    threads: init.kind === 'ready' ? init.initialThreads : EMPTY_THREADS,
    dmRooms: init.kind === 'ready' ? init.initialDmRooms : EMPTY_DMS,
    threadLastSeen: init.kind === 'ready' ? init.initialLastSeen.threads : EMPTY_LAST_SEEN_MAP,
    dmLastSeen: init.kind === 'ready' ? init.initialLastSeen.dms : EMPTY_LAST_SEEN_MAP,
  });

  const handleClick = useCallback(() => {
    const url = `/profile/support/${encodeURIComponent(entityDid)}?prompts=${encodeURIComponent(promptsKey)}`;
    void router.push(url);
  }, [entityDid, promptsKey, router]);

  return <SupportIconButton onClick={handleClick} hasUnread={init.kind === 'ready' && unread.any} />;
}

// Stable empty references so the unread hook's deps don't churn while init is loading.
const EMPTY_THREADS: never[] = [];
const EMPTY_DMS: never[] = [];
const EMPTY_LAST_SEEN_MAP: Record<string, number> = {};
