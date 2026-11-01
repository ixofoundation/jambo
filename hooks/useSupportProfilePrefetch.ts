import { useEffect, useRef } from 'react';

import { prefetchMatrixProfile } from '@utils/matrixProfile';

/**
 * Fetch matrix profiles for every user id passed in, at most once per hook lifetime.
 * Caller can pass a fresh iterable each render; the hook dedupes via an internal ref.
 * did-ixo user ids resolve through the names worker (one batched request for all
 * ids seen in a render); others through the user's Matrix session.
 */
export function useSupportProfilePrefetch(userIds: Iterable<string>): void {
  const seenRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    for (const id of userIds) {
      if (!id) continue;
      if (seenRef.current.has(id)) continue;
      seenRef.current.add(id);
      void prefetchMatrixProfile(id);
    }
    // userIds may be a Set / array / generator — we intentionally don't include it in deps;
    // the effect re-runs on every render anyway and the ref dedupes work.
  });
}
