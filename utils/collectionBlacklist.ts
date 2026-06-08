import { store } from '@store/index';
import { setCollectionBlacklist } from '@store/slices/collectionsSlice';
import { getCollectionBlacklist } from 'lib/yomaWorker/client';
import { readCache, writeCache } from '@utils/workerCache';

const cacheKey = (entityDid: string) => `collectionBlacklist:${entityDid}`;

export function readCachedCollectionBlacklist(entityDid: string): string[] | null {
  return readCache<string[]>(cacheKey(entityDid));
}

/** Write a known blacklist to both the cache and the store. */
export function persistCollectionBlacklist(entityDid: string, blacklist: string[]): void {
  writeCache(cacheKey(entityDid), blacklist);
  store.dispatch(setCollectionBlacklist({ entityDid, blacklist }));
}

/** Seed the store from cache, but only when the store has no value yet (so we
 *  never clobber a fresher value already synced this session). */
export function hydrateCollectionBlacklistFromCache(entityDid: string): void {
  if (store.getState().collections.blacklistByEntityDid?.[entityDid]) return;
  const cached = readCachedCollectionBlacklist(entityDid);
  if (cached) store.dispatch(setCollectionBlacklist({ entityDid, blacklist: cached }));
}

/** Fetch the authoritative blacklist from the worker and persist it. Returns the
 *  list, or null if the worker was unreachable (cache/store left untouched). */
export async function syncCollectionBlacklist(entityDid: string): Promise<string[] | null> {
  const res = await getCollectionBlacklist(entityDid);
  if (!res.ok) return null;
  const list = res.data.blacklist ?? [];
  persistCollectionBlacklist(entityDid, list);
  return list;
}

/** Cache-first load: show cached immediately + refresh in the background; on a
 *  cold load (no cache) await the worker so collections filter correctly. */
export async function ensureCollectionBlacklist(entityDid: string): Promise<void> {
  const cached = readCachedCollectionBlacklist(entityDid);
  if (cached) {
    hydrateCollectionBlacklistFromCache(entityDid);
    void syncCollectionBlacklist(entityDid);
    return;
  }
  await syncCollectionBlacklist(entityDid);
}
