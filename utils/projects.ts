import { store } from '@store/index';
import { setProjects } from '@store/slices/projectsSlice';
import { listWhitelistedEntities } from 'lib/yomaWorker/client';
import { readCache, writeCache } from '@utils/workerCache';

const CACHE_KEY = 'whitelistedEntities';

/** Fetch the authoritative whitelist from the worker and persist it to cache +
 *  store. Returns the ids, or null if the worker was unreachable. */
async function syncWhitelistedEntities(): Promise<string[] | null> {
  const res = await listWhitelistedEntities();
  if (!res.ok) return null;
  const ids = res.data.entities ?? [];
  writeCache(CACHE_KEY, ids);
  store.dispatch(setProjects(ids));
  return ids;
}

/**
 * Loads the entities the app surfaces as "projects" from the jambo worker
 * whitelist. Cache-first: returns the cached list instantly (and refreshes in
 * the background) so the app isn't online-dependent; on a cold load it awaits
 * the worker. The worker is the source of truth — an explicit empty whitelist is
 * respected; the cache is the only offline fallback.
 */
export async function loadWhitelistedEntities(): Promise<string[]> {
  const cached = readCache<string[]>(CACHE_KEY);
  if (cached) {
    store.dispatch(setProjects(cached));
    void syncWhitelistedEntities(); // background refresh
    return cached;
  }
  const fresh = await syncWhitelistedEntities();
  return fresh ?? [];
}
