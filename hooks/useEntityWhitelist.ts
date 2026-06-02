import { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';

import { secret } from '@utils/secrets';
import { listWhitelistedEntities, removeWhitelistedEntity, whitelistEntity } from 'lib/yomaWorker/client';

/**
 * Manages the worker entity whitelist for the admin config screen: loads the
 * current list and exposes add/remove mutations (matrix-access-token gated on
 * the worker). The graphql "does this entity have collections?" pre-check lives
 * in the screen, since it drives a confirm step before add() is called.
 */
export default function useEntityWhitelist() {
  const [entities, setEntities] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [mutating, setMutating] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const res = await listWhitelistedEntities();
    if (res.ok) {
      setEntities(res.data.entities ?? []);
    } else if (res.reason === 'not-found') {
      setEntities([]);
    } else {
      toast.error(res.message || 'Could not load whitelisted entities');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const add = useCallback(
    async (entityDid: string): Promise<boolean> => {
      const token = secret.accessToken;
      if (!token) {
        toast.error('Not authenticated');
        return false;
      }
      setMutating(true);
      const res = await whitelistEntity(entityDid, token);
      setMutating(false);
      if (res.ok) {
        await refresh();
        return true;
      }
      toast.error(res.message || 'Failed to whitelist entity');
      return false;
    },
    [refresh],
  );

  const remove = useCallback(
    async (entityDid: string): Promise<void> => {
      const token = secret.accessToken;
      if (!token) {
        toast.error('Not authenticated');
        return;
      }
      setMutating(true);
      const res = await removeWhitelistedEntity(entityDid, token);
      setMutating(false);
      if (res.ok) {
        await refresh();
      } else {
        toast.error(res.message || 'Failed to remove entity');
      }
    },
    [refresh],
  );

  return { entities, loading, mutating, add, remove, refresh };
}
