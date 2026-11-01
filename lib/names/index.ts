import { NAMES_CLIENT_ID, NAMES_WORKER_URL } from '@constants/names';
import {
  classifyIdentifier,
  createNamesClient,
  type FetchLike,
  type IncludeGroup,
  type NamesClient,
  type ResolvedName,
} from '@ixo/names-client';

/**
 * Jambo's access to the IXO Names worker (see docs/names.md). One client per
 * app: its memo, 10 ms request coalescing and backoff are shared by every
 * caller, so rows that each ask for one id still produce one request. The React
 * hook is in hooks/useNames.ts: this file stays free of React.
 */

const LOG_PREFIX = '[names]';

/** Lists and avatars: the name (or the canonical abbreviation) and the image. */
export const PROFILE_INCLUDE: readonly IncludeGroup[] = ['image', 'name'];

/** Profile plus the Matrix group, to check a Matrix user id against the address's own homeserver. */
export const MATRIX_PROFILE_INCLUDE: readonly IncludeGroup[] = ['image', 'matrix', 'name'];

export function createJamboNamesClient(baseUrl: string, fetchImpl?: FetchLike): NamesClient {
  return createNamesClient({
    baseUrl,
    ...(fetchImpl ? { fetch: fetchImpl } : {}),
    headers: { 'X-Client-Id': NAMES_CLIENT_ID },
    onError: (error) => console.warn(`${LOG_PREFIX} ${error.code}: ${error.message}`),
  });
}

let singleton: NamesClient | null | undefined;

/** The app's names client, or null when no worker is configured (local chain without an override). */
export function getNamesClient(): NamesClient | null {
  if (singleton === undefined) singleton = NAMES_WORKER_URL ? createJamboNamesClient(NAMES_WORKER_URL) : null;
  return singleton;
}

/** The worker's image for a result when it is an https URL, else null. */
export function workerImage(result: ResolvedName | undefined): string | null {
  if (!result?.image) return null;
  try {
    return new URL(result.image).protocol === 'https:' ? result.image : null;
  } catch {
    return null;
  }
}

/** `promise`'s value, or undefined when it has not settled within `ms`. The timer is always cleared. */
export async function withinMs<T>(promise: Promise<T>, ms: number): Promise<T | undefined> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<undefined>((resolve) => {
    timer = setTimeout(() => resolve(undefined), ms);
  });
  try {
    return await Promise.race([promise, deadline]);
  } finally {
    clearTimeout(timer);
  }
}

export interface NamesMatrixProfile {
  displayName: string | null;
  avatarUrl: string | null;
}

/** A `@did-ixo-<address>:<server>` id, the only Matrix user ids the worker takes (the client's classifier decides). */
const isIxoMatrixUserId = (userId: string): boolean =>
  userId.startsWith('@') && classifyIdentifier(userId).kind === 'account';

/**
 * A Matrix user's name and avatar from the worker. The id goes in as it is, and
 * the answer is about its ADDRESS: the server name selects nothing. So the
 * answer counts only when `matrix.userId`, the address's own Matrix user id (its
 * DID's homeserver), is this id. Anyone can register `@did-ixo-<someone's
 * address>` on another homeserver; that account must not be shown with the real
 * holder's name.
 *
 * Null means "the worker cannot vouch for this user id" and the caller keeps
 * its own (session) profile read:
 * - not a did-ixo user id (never sent), or no worker configured;
 * - an incomplete answer: a transient worker-side failure, or a worker from
 *   before Matrix ids, which the client reports as incomplete;
 * - `matrix.userId` is not this id.
 * A complete answer is final, including the worker's "no name" (`displayName: null`).
 */
export async function resolveMatrixProfile(
  client: NamesClient | null,
  userId: string,
): Promise<NamesMatrixProfile | null> {
  if (!client || !isIxoMatrixUserId(userId)) return null;
  const result = (await client.resolve([userId], { include: MATRIX_PROFILE_INCLUDE }))[userId];
  if (!result?.complete || result.matrix?.userId !== userId) return null;
  return { displayName: result.name ?? null, avatarUrl: workerImage(result) };
}

export type { IncludeGroup, NamesClient, ResolvedName } from '@ixo/names-client';
