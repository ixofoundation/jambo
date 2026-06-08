import { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';

import { secret } from '@utils/secrets';
import { persistCollectionBlacklist } from '@utils/collectionBlacklist';
import { blacklistCollection, getCollectionBlacklist, unblacklistCollection } from 'lib/yomaWorker/client';

/**
 * Loads and mutates an entity's claim-collection blacklist on the worker. A
 * collection id present in `blacklist` is hidden from the app; toggling drives
 * the matrix-access-token-gated POST/DELETE worker endpoints.
 */
export default function useCollectionBlacklist(entityDid: string | undefined) {
  const [blacklist, setBlacklist] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    if (!entityDid) return;
    setLoading(true);
    const res = await getCollectionBlacklist(entityDid);
    if (res.ok) {
      const list = res.data.blacklist ?? [];
      setBlacklist(new Set(list));
      // Share with the rest of the app (cache + store) so listings stay in sync.
      persistCollectionBlacklist(entityDid, list);
    } else if (res.reason === 'not-found') {
      setBlacklist(new Set());
      persistCollectionBlacklist(entityDid, []);
    } else {
      toast.error(res.message || 'Could not load the collection blacklist');
    }
    setLoading(false);
  }, [entityDid]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const setBlacklisted = useCallback(
    async (collectionId: string, shouldBlacklist: boolean): Promise<void> => {
      if (!entityDid) return;
      const token = secret.accessToken;
      if (!token) {
        toast.error('Not authenticated');
        return;
      }

      setSavingIds((prev) => new Set(prev).add(collectionId));
      const res = shouldBlacklist
        ? await blacklistCollection(entityDid, collectionId, token)
        : await unblacklistCollection(entityDid, collectionId, token);
      setSavingIds((prev) => {
        const next = new Set(prev);
        next.delete(collectionId);
        return next;
      });

      if (res.ok) {
        setBlacklist((prev) => {
          const next = new Set(prev);
          if (shouldBlacklist) next.add(collectionId);
          else next.delete(collectionId);
          // Keep cache + store (and therefore the rest of the app) in sync.
          persistCollectionBlacklist(entityDid, Array.from(next));
          return next;
        });
      } else {
        toast.error(res.message || 'Failed to update the collection blacklist');
      }
    },
    [entityDid],
  );

  return { blacklist, loading, savingIds, setBlacklisted, refresh };
}
