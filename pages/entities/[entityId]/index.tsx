import { useEffect } from 'react';
import { useRouter } from 'next/router';

import AuthGuard from '@components/AuthGuard';
import Dashboard from 'screens/dashboard';
import { isCleanupEntity, openCleanup } from '@constants/cleanup';
import { saveYref } from '@utils/yomaLink';

export default function EntityPage() {
  const router = useRouter();
  const entityId = router.isReady ? (router.query.entityId as string | undefined) : undefined;
  const cleanup = isCleanupEntity(entityId);

  // The cleanup deed's own address — the Yoma hand-off lands here — opens the
  // youth app, signed in or not (it asks for the login itself, through this
  // app). The hand-off marker is kept first: the root provider would also
  // catch it, but we are leaving the page and should not depend on effect
  // order for it.
  useEffect(() => {
    if (!cleanup) return;
    const yref = router.query.yref;
    if (typeof yref === 'string') saveYref(yref);
    openCleanup(true);
  }, [cleanup, router.query.yref]);

  if (!router.isReady || cleanup) return null;

  return (
    <AuthGuard>
      <Dashboard />
    </AuthGuard>
  );
}
