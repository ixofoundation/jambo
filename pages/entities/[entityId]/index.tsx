import { useEffect } from 'react';
import { useRouter } from 'next/router';

import AuthGuard from '@components/AuthGuard';
import Dashboard from 'screens/dashboard';
import { isCleanupEntity, openCleanup } from '@constants/cleanup';
import { saveYref } from '@utils/yomaLink';

/**
 * The cleanup deed's own address — where the Yoma hand-off lands — opens the
 * youth app instead of the deed view, but only past the same login gate every
 * deed has: somebody signed out sees Jambo's sign-in first (a Yoma email, a
 * new account), comes back to this address, and then walks through. The
 * hand-off marker is kept first: the root provider also catches it, but we
 * are leaving the page and should not depend on effect order for it.
 */
function CleanupDoor({ yref }: { yref: string | string[] | undefined }) {
  useEffect(() => {
    if (typeof yref === 'string') saveYref(yref);
    openCleanup(true);
  }, [yref]);
  return null;
}

export default function EntityPage() {
  const router = useRouter();
  const entityId = router.isReady ? (router.query.entityId as string | undefined) : undefined;

  if (!router.isReady) return null;

  return <AuthGuard>{isCleanupEntity(entityId) ? <CleanupDoor yref={router.query.yref} /> : <Dashboard />}</AuthGuard>;
}
