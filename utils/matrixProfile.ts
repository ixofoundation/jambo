import { store } from '@store/index';
import {
  setMatrixUserProfile,
  setMatrixUserProfilePending,
  clearMatrixUserProfilePending,
  MatrixUserProfile,
} from '@store/slices/matrixProfilesSlice';
import { getNamesClient, resolveMatrixProfile, withinMs } from 'lib/names';
import { secret } from './secrets';
import { cleanUrlString } from './url';

const PROFILE_TTL_MS = 10 * 60 * 1000;

/** How long a sender's name waits for the names worker before the session read starts. */
export const NAMES_WORKER_WAIT_MS = 3000;

/**
 * Fill `matrixProfiles` for a Matrix user id seen in a room. `@did-ixo-<address>:<host>`
 * ids whose host is the address's own homeserver come from the names worker
 * (batched with every other id asked in the same tick, memoised). The profile is
 * read with the user's own Matrix session instead when:
 * - the id is not one the worker can vouch for, or the worker failed;
 * - the worker has not answered within NAMES_WORKER_WAIT_MS (a stalled worker
 *   must not keep support names blank until its 15 s timeout).
 * A complete worker answer is final, including "no name". A late worker answer
 * is used only when the session read produced nothing.
 */
export async function prefetchMatrixProfile(userId: string): Promise<void> {
  if (!userId) return;
  const worker = resolveMatrixProfile(getNamesClient(), userId);
  const fromNames = await withinMs(worker, NAMES_WORKER_WAIT_MS);
  if (fromNames) {
    store.dispatch(setMatrixUserProfile({ userId, ...fromNames }));
    return;
  }
  const fromSession = await fetchMatrixProfileByUserId(userId);
  // `undefined` is the timeout; `null` means the worker settled and cannot vouch.
  if (fromSession || fromNames === null) return;
  const late = await worker;
  if (late) store.dispatch(setMatrixUserProfile({ userId, ...late }));
}

/** Read a Matrix profile with the logged-in user's session (10 min TTL in `matrixProfiles`). */
export async function fetchMatrixProfileByUserId(userId: string): Promise<MatrixUserProfile | null> {
  if (!userId) return null;

  const state = store.getState();
  const cached = state.matrixProfiles.byUserId[userId];
  if (cached && Date.now() - cached.fetchedAt < PROFILE_TTL_MS) return cached;
  if (state.matrixProfiles.pending[userId]) return cached ?? null;

  const baseUrl = secret.baseUrl;
  const accessToken = secret.accessToken;
  if (!baseUrl || !accessToken) return cached ?? null;

  store.dispatch(setMatrixUserProfilePending({ userId }));
  try {
    const res = await fetch(cleanUrlString(`${baseUrl}/_matrix/client/v3/profile/${encodeURIComponent(userId)}`), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      store.dispatch(setMatrixUserProfile({ userId, displayName: null, avatarUrl: null }));
      return { displayName: null, avatarUrl: null, fetchedAt: Date.now() };
    }
    const data = await res.json();
    const avatarUrl = data?.avatar_url
      ? cleanUrlString(
          `${baseUrl}/_matrix/media/v3/thumbnail/${String(data.avatar_url).replace('mxc://', '')}?width=96&height=96&method=crop`,
        )
      : null;
    const displayName = data?.displayname ?? null;
    store.dispatch(setMatrixUserProfile({ userId, displayName, avatarUrl }));
    return { displayName, avatarUrl, fetchedAt: Date.now() };
  } catch (err) {
    console.warn('[matrixProfile] fetch failed', userId, err);
    store.dispatch(clearMatrixUserProfilePending({ userId }));
    return cached ?? null;
  }
}
