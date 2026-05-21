import { useEffect, useRef } from 'react';

import { fetchMatrixProfileByUserId } from '@utils/matrixProfile';

/**
 * Fetch matrix profiles for every user id passed in, at most once per hook lifetime.
 * Caller can pass a fresh iterable each render; the hook dedupes via an internal ref.
 */
export function useSupportProfilePrefetch(userIds: Iterable<string>): void {
  const seenRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    for (const id of userIds) {
      if (!id) continue;
      if (seenRef.current.has(id)) continue;
      seenRef.current.add(id);
      void fetchMatrixProfileByUserId(id);
    }
    // userIds may be a Set / array / generator — we intentionally don't include it in deps;
    // the effect re-runs on every render anyway and the ref dedupes work.
  });
}
