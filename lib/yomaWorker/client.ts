import { IS_JAMBO_WORKER_ENABLED, JAMBO_WORKER_API_BASE } from './config';
import type {
  CollectionClaimsResponse,
  CollectionLinksResponse,
  RegisterSubclaimLinkageInput,
  WorkerEnvelope,
} from './types';

const LOG_PREFIX = '[yomaWorker]';

export type WorkerResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: 'not-found' | 'network' | 'disabled'; status?: number; message?: string };

async function safeFetch<T>(path: string, init?: RequestInit): Promise<WorkerResult<T>> {
  if (!IS_JAMBO_WORKER_ENABLED) return { ok: false, reason: 'disabled' };
  try {
    const res = await fetch(`${JAMBO_WORKER_API_BASE}${path}`, init);
    const text = await res.text();
    let body: WorkerEnvelope<T> | null = null;
    if (text) {
      try {
        body = JSON.parse(text) as WorkerEnvelope<T>;
      } catch {
        body = null;
      }
    }
    if (!res.ok) {
      console.warn(`${LOG_PREFIX} ${init?.method || 'GET'} ${path} failed`, res.status, body?.message);
      if (res.status === 404) return { ok: false, reason: 'not-found', status: 404, message: body?.message };
      return { ok: false, reason: 'network', status: res.status, message: body?.message };
    }
    if (body?.data == null) return { ok: false, reason: 'not-found', status: res.status };
    return { ok: true, data: body.data };
  } catch (err) {
    console.warn(`${LOG_PREFIX} ${init?.method || 'GET'} ${path} threw`, err);
    return { ok: false, reason: 'network', message: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Asks the worker whether the current user is a whitelisted admin. The worker's
 * matrix-auth middleware resolves the matrix access token to a DID and only
 * returns 200 when that DID is whitelisted — anything else (401/403/network)
 * is treated as "not an admin". Pass the matrix access token (secret.accessToken).
 */
export async function checkIsAdmin(accessToken: string | null | undefined): Promise<boolean> {
  if (!IS_JAMBO_WORKER_ENABLED || !accessToken) return false;
  try {
    const res = await fetch(`${JAMBO_WORKER_API_BASE}/v1/admins/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return false;
    const body = (await res.json()) as WorkerEnvelope<{ isAdmin?: boolean }>;
    return body?.data?.isAdmin === true;
  } catch (err) {
    console.warn(`${LOG_PREFIX} GET /v1/admins/me threw`, err);
    return false;
  }
}

/** Public read of the entity whitelist (the DIDs allowed to appear in the app). */
export function listWhitelistedEntities(): Promise<WorkerResult<{ entities: string[] }>> {
  return safeFetch<{ entities: string[] }>('/v1/entities');
}

/**
 * Whitelists an entity. Admin-only on the worker — pass the matrix access token
 * (secret.accessToken), which the worker resolves to a whitelisted admin DID.
 */
export function whitelistEntity(
  entityDid: string,
  accessToken: string,
): Promise<WorkerResult<{ entityDid: string }>> {
  return safeFetch<{ entityDid: string }>('/v1/entities', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ entityDid }),
  });
}

/** Removes an entity from the whitelist. Admin-only (matrix access token). */
export function removeWhitelistedEntity(
  entityDid: string,
  accessToken: string,
): Promise<WorkerResult<{ entityDid: string }>> {
  return safeFetch<{ entityDid: string }>(`/v1/entities/${encodeURIComponent(entityDid)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

/** Public read of an entity's blacklisted claim-collection ids. */
export function getCollectionBlacklist(
  entityDid: string,
): Promise<WorkerResult<{ entityDid: string; blacklist: string[] }>> {
  return safeFetch<{ entityDid: string; blacklist: string[] }>(
    `/v1/collections/${encodeURIComponent(entityDid)}`,
  );
}

/** Blacklists a claim collection for an entity. Admin-only (matrix access token). */
export function blacklistCollection(
  entityDid: string,
  collectionId: string,
  accessToken: string,
): Promise<WorkerResult<{ entityDid: string; collectionId: string }>> {
  return safeFetch<{ entityDid: string; collectionId: string }>(
    `/v1/collections/${encodeURIComponent(entityDid)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ collectionId }),
    },
  );
}

/** Removes a claim collection from an entity's blacklist. Admin-only (matrix access token). */
export function unblacklistCollection(
  entityDid: string,
  collectionId: string,
  accessToken: string,
): Promise<WorkerResult<{ entityDid: string; collectionId: string }>> {
  return safeFetch<{ entityDid: string; collectionId: string }>(
    `/v1/collections/${encodeURIComponent(entityDid)}/${encodeURIComponent(collectionId)}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
}

export function getCollectionLinks(collectionId: string): Promise<WorkerResult<CollectionLinksResponse>> {
  return safeFetch<CollectionLinksResponse>(`/v1/collectiononcollection/${encodeURIComponent(collectionId)}`);
}

export function getClaimsWithSubclaims(
  parentCollectionId: string,
): Promise<WorkerResult<CollectionClaimsResponse>> {
  return safeFetch<CollectionClaimsResponse>(
    `/v1/claimonclaim/collections/${encodeURIComponent(parentCollectionId)}`,
  );
}

export async function registerSubclaimLinkage(input: RegisterSubclaimLinkageInput): Promise<boolean> {
  if (!IS_JAMBO_WORKER_ENABLED) return false;
  const { parentCollectionId, parentClaimId, subClaimCollectionId, subClaimId, agentDid } = input;
  const path = `/v1/claimonclaim/collections/${encodeURIComponent(parentCollectionId)}/claims/${encodeURIComponent(
    parentClaimId,
  )}`;
  try {
    const res = await fetch(`${JAMBO_WORKER_API_BASE}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: agentDid,
      },
      body: JSON.stringify({
        collectionId: parentCollectionId,
        claimId: parentClaimId,
        subClaimCollectionId,
        subClaimId,
        agentDid,
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.warn(`${LOG_PREFIX} POST ${path} failed`, res.status, text);
      return false;
    }
    return true;
  } catch (err) {
    console.warn(`${LOG_PREFIX} POST ${path} threw`, err);
    return false;
  }
}

export function refreshClaimStatus(parentClaimId: string): void {
  if (!IS_JAMBO_WORKER_ENABLED) return;
  const path = `/v1/claimonclaim/claims/${encodeURIComponent(parentClaimId)}`;
  fetch(`${JAMBO_WORKER_API_BASE}${path}`).catch((err) => console.warn(`${LOG_PREFIX} GET ${path} threw`, err));
}
