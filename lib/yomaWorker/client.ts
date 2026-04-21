import { IS_JAMBO_WORKER_ENABLED, JAMBO_WORKER_API_BASE } from './config';
import type {
  AllowedSubcollectionsResponse,
  CollectionClaimsResponse,
  RegisterSubclaimLinkageInput,
  WorkerEnvelope,
} from './types';

const LOG_PREFIX = '[yomaWorker]';

async function safeFetch<T>(path: string, init?: RequestInit): Promise<T | null> {
  if (!IS_JAMBO_WORKER_ENABLED) return null;
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
      return null;
    }
    return (body?.data ?? null) as T | null;
  } catch (err) {
    console.warn(`${LOG_PREFIX} ${init?.method || 'GET'} ${path} threw`, err);
    return null;
  }
}

export function getAllowedSubcollections(parentCollectionId: string): Promise<AllowedSubcollectionsResponse | null> {
  return safeFetch<AllowedSubcollectionsResponse>(
    `/v1/collectiononcollection/collections/${encodeURIComponent(parentCollectionId)}`,
  );
}

export function getClaimsWithSubclaims(parentCollectionId: string): Promise<CollectionClaimsResponse | null> {
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
