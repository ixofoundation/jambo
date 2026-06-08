import { useEffect } from 'react';

import { useAppSelector } from '@store/hooks';
import {
  hydrateCollectionBlacklistFromCache,
  syncCollectionBlacklist,
} from '@utils/collectionBlacklist';

/**
 * Resolves whether a collection is blacklisted (hidden) for its entity, per the
 * worker. Returns `null` while still unknown so callers can avoid leaking hidden
 * content on a cold deep-link. Reads the store (seeded from cache instantly when
 * available — no flash/delay when arriving from the dashboard) and refreshes in
 * the background. A worker error leaves the cached/empty value, so access isn't
 * wrongly blocked when offline.
 */
export default function useIsCollectionBlacklisted(
  entityDid?: string,
  collectionId?: string,
): boolean | null {
  const storeBlacklist = useAppSelector((s) =>
    entityDid ? s.collections.blacklistByEntityDid?.[entityDid] : undefined,
  );

  useEffect(() => {
    if (!entityDid) return;
    hydrateCollectionBlacklistFromCache(entityDid); // instant if cached
    void syncCollectionBlacklist(entityDid); // refresh in the background
  }, [entityDid]);

  if (!collectionId) return false;
  if (storeBlacklist == null) return null; // not hydrated/fetched yet
  return storeBlacklist.includes(collectionId);
}
