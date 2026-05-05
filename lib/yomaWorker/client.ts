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
