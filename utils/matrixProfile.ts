import { store } from '@store/index';
import {
  setMatrixUserProfile,
  setMatrixUserProfilePending,
  clearMatrixUserProfilePending,
  MatrixUserProfile,
} from '@store/slices/matrixProfilesSlice';
import { secret } from './secrets';
import { cleanUrlString } from './url';
import { generateUsernameFromAddress } from './matrix';

const PROFILE_TTL_MS = 10 * 60 * 1000;

function addressToHomeserverHost(userId: string | null | undefined): string | null {
  if (!userId) return null;
  const parts = userId.split(':');
  if (parts.length < 2) return null;
  return parts.slice(1).join(':');
}

export function matrixUserIdForAddress(address: string): string | null {
  if (!address) return null;
  const homeserverHost = addressToHomeserverHost(secret.userId);
  if (!homeserverHost) return null;
  const username = generateUsernameFromAddress(address);
  return `@${username}:${homeserverHost}`;
}

export function getCachedMatrixProfile(userId: string): MatrixUserProfile | null {
  const state = store.getState();
  const cached = state.matrixProfiles.byUserId[userId];
  if (!cached) return null;
  if (Date.now() - cached.fetchedAt > PROFILE_TTL_MS) return cached; // still return stale while refreshing
  return cached;
}

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

export async function fetchMatrixProfileForAddress(address: string): Promise<MatrixUserProfile | null> {
  const userId = matrixUserIdForAddress(address);
  if (!userId) return null;
  return fetchMatrixProfileByUserId(userId);
}
