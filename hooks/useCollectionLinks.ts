import { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';

import { secret } from '@utils/secrets';
import { addCollectionLink, getCollectionLinks, removeCollectionLink } from 'lib/yomaWorker/client';

export type LinkDirection = 'base' | 'sub';

export function linkSavingKey(direction: LinkDirection, otherCollectionId: string): string {
  return `${direction}:${otherCollectionId}`;
}

/**
 * Loads and mutates a collection's base/sub links on the worker (admin-only
 * writes, matrix access token — mirrors useCollectionBlacklist). `base` lists
 * the collections this one is a sub of; `sub` lists the collections that are
 * subs of this one. `addLink('base', X)` makes X a base of this collection
 * (i.e. this collection becomes a sub of X); `addLink('sub', X)` the reverse.
 */
export default function useCollectionLinks(collectionId: string | undefined) {
  const [base, setBase] = useState<string[]>([]);
  const [sub, setSub] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingKeys, setSavingKeys] = useState<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    if (!collectionId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const res = await getCollectionLinks(collectionId);
    if (res.ok) {
      setBase(res.data.base ?? []);
      setSub(res.data.sub ?? []);
    } else if (res.reason === 'not-found' || res.reason === 'disabled') {
      // No links registered / worker feature off — a quiet empty state, like SubclaimModal.
      setBase([]);
      setSub([]);
    } else {
      // Real failure: surface it so the panel doesn't render editable lists over unknown state.
      setError(res.message || 'Could not load collection links');
    }
    setLoading(false);
  }, [collectionId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const mutateLink = useCallback(
    async (action: 'add' | 'remove', direction: LinkDirection, otherCollectionId: string): Promise<void> => {
      if (!collectionId) return;
      const token = secret.accessToken;
      if (!token) {
        toast.error('Not authenticated');
        return;
      }

      // The worker's POST/DELETE address a (base, sub) pair; map the direction
      // onto it: direction 'base' means the other collection is the base.
      const baseId = direction === 'base' ? otherCollectionId : collectionId;
      const subId = direction === 'base' ? collectionId : otherCollectionId;

      const key = linkSavingKey(direction, otherCollectionId);
      setSavingKeys((prev) => new Set(prev).add(key));
      const res =
        action === 'add'
          ? await addCollectionLink(baseId, subId, token)
          : await removeCollectionLink(baseId, subId, token);
      setSavingKeys((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });

      if (res.ok) {
        const update = (prev: string[]) =>
          action === 'add' ? [...prev.filter((id) => id !== otherCollectionId), otherCollectionId] : prev.filter((id) => id !== otherCollectionId);
        if (direction === 'base') setBase(update);
        else setSub(update);
      } else {
        toast.error(res.message || 'Failed to update the collection link');
      }
    },
    [collectionId],
  );

  const addLink = useCallback(
    (direction: LinkDirection, otherCollectionId: string) => mutateLink('add', direction, otherCollectionId),
    [mutateLink],
  );
  const removeLink = useCallback(
    (direction: LinkDirection, otherCollectionId: string) => mutateLink('remove', direction, otherCollectionId),
    [mutateLink],
  );

  return { base, sub, loading, error, savingKeys, addLink, removeLink, refresh };
}
