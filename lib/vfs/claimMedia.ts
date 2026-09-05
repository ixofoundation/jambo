/**
 * Claim evidence on the IXO Virtual Filesystem — the VFS "claims lane".
 *
 * Claim media (survey attachments, photos, VIDEO) is stored in the claim collection's OWNING
 * ENTITY namespace under the hidden per-collection folder `/.claims/<collectionId>/…`. The VFS
 * authorizes lane requests by ON-CHAIN CLAIM AUTHORIZATIONS (Submit/Evaluate incl. POD & MsgExec
 * acting-for; admin + entity controllers read) — the same rules the claims bot enforces on its
 * Matrix media store — so switching storage changes where bytes live, not who may touch them.
 * Evidence is write-once, never public and never indexed. Worker contract:
 * ixo-virtual-filesystem `CLAIMS_LANE.md` / DECISIONS D42.
 *
 * The reference stored in the claim answer mirrors the claims-bot shape (`type:
 * "mediaAttachment"`, `proof` = content CID, `serviceEndpoint` = fetchable URL) so every
 * existing reader keeps working; the serviceEndpoint is SELF-DESCRIBING — it carries the entity
 * DID and collection id as query params, exactly what a reader needs to mint the lane-scoped
 * read token. Backward compatibility is a URL-shape check: `…/media/collections/…` → claims bot
 * (legacy, Matrix), `…/api/fs/cid/…` → VFS (this module). Old claims stay readable forever.
 *
 * Auth: one fresh single-use UCAN per request — including per resumable-upload part — signed
 * with the user's ed25519 signing key (utils/ucanVfs.ts), scoped to the ONE collection lane.
 */
import { VFS_BASE_URL, VFS_RESOURCE } from '@constants/vfs';
import { fetchCollectionByCollectionId } from '@utils/claims';
import { mintVfsInvocation } from '@utils/ucanVfs';

import { tusUploadToVfs, VFS_SINGLE_SHOT_MAX_BYTES } from './tusUpload';

/** The UCAN resource scoping a token to ONE collection's evidence lane. */
export function claimsLaneResource(entityDid: string, collectionId: string): string {
  return `${VFS_RESOURCE}/${entityDid}/.claims/${collectionId}`;
}

export interface VfsClaimMediaTarget {
  cid: string;
  entityDid: string;
  collectionId: string;
}

/**
 * Recognize a VFS claim-media serviceEndpoint and extract what a reader needs to mint the lane
 * token. Returns null for anything else (claims-bot URLs, IPFS gateways, data URLs …) — the
 * caller then keeps the legacy claims-bot path, which is what keeps old claims readable.
 */
export function parseVfsClaimMediaUrl(url: unknown): VfsClaimMediaTarget | null {
  if (typeof url !== 'string' || !/^https?:/i.test(url)) return null;
  try {
    const u = new URL(url);
    const m = u.pathname.match(/\/api\/fs\/cid\/([^/]+)$/);
    const entityDid = u.searchParams.get('entity');
    const collectionId = u.searchParams.get('collection');
    if (!m || !entityDid || !collectionId) return null;
    return { cid: decodeURIComponent(m[1]), entityDid, collectionId };
  } catch {
    return null;
  }
}

/** serviceEndpoint of a stored file reference (JSON string or object), or null. */
export function refServiceEndpoint(raw: unknown): string | null {
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const endpoint = (parsed as { serviceEndpoint?: unknown } | null)?.serviceEndpoint;
    return typeof endpoint === 'string' ? endpoint : null;
  } catch {
    return null;
  }
}

/** The collection's OWNING entity — the lane lives in that entity's namespace (NOT the deed or
 *  protocol entity). Served from the redux collection cache after the first chain lookup. */
async function resolveCollectionEntityDid(collectionId: string): Promise<string> {
  const collection = await fetchCollectionByCollectionId(collectionId);
  const entityDid = (collection as { entity?: string })?.entity;
  if (!entityDid) throw new Error(`Could not resolve claim collection ${collectionId} to its entity`);
  return entityDid;
}

interface VfsUploadedFile {
  id: string;
  cid: string;
  path: string;
}

/** Build the mediaAttachment reference stored in the claim answer (claims-bot-compatible shape,
 *  plus the VFS coordinates old readers simply ignore). */
function buildRef(uploaded: VfsUploadedFile, mediaType: string, entityDid: string, collectionId: string) {
  const serviceEndpoint = `${VFS_BASE_URL}/api/fs/cid/${encodeURIComponent(uploaded.cid)}?entity=${encodeURIComponent(
    entityDid,
  )}&collection=${encodeURIComponent(collectionId)}`;
  return {
    id: `{id}#${uploaded.cid}`,
    type: 'mediaAttachment',
    proof: uploaded.cid,
    encrypted: true,
    mediaType,
    description: '',
    serviceEndpoint,
    vfs: { fileId: uploaded.id, path: uploaded.path, entityDid, collectionId },
  };
}

function evidencePath(collectionId: string, fileName: string): string {
  // Write-once lane: a fresh UUID prefix guarantees a free path; the original name is kept for
  // humans (sanitized to path-safe characters).
  const safe = (fileName || 'file').replace(/[^\w.-]+/g, '_').slice(0, 120) || 'file';
  const unique =
    typeof globalThis.crypto?.randomUUID === 'function' ? globalThis.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `/.claims/${collectionId}/${unique}-${safe}`;
}

async function singleShotUpload(file: File | Blob, path: string, resource: string, did: string): Promise<VfsUploadedFile> {
  const bearer = await mintVfsInvocation(did, 'fs/write', resource);
  const res = await fetch(`${VFS_BASE_URL}/api/fs/files?path=${encodeURIComponent(path)}`, {
    method: 'POST',
    body: file,
    headers: {
      Authorization: `Bearer ${bearer}`,
      'X-Auth-Type': 'ucan',
      'Content-Type': file.type || 'application/octet-stream',
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(`Evidence upload failed: ${res.status} ${body?.message ?? ''}`.trim());
  }
  const meta = (await res.json()) as { id: string; cid: string; path: string };
  return { id: meta.id, cid: meta.cid, path: meta.path };
}

function resumableUpload(file: File | Blob, path: string, resource: string, did: string): Promise<VfsUploadedFile> {
  return tusUploadToVfs({
    baseUrl: VFS_BASE_URL,
    path,
    file,
    mimeType: file.type || 'application/octet-stream',
    getBearer: () => mintVfsInvocation(did, 'fs/write', resource),
  });
}

/**
 * Upload one claim evidence file into the collection's VFS lane and return the claims-bot-shaped
 * `{ file, content }` the SurveyJS upload handler stores (content = JSON-stringified reference).
 * Small files go single-shot; large files (video) go over resumable tus.
 */
export async function uploadClaimFileToVfs(
  file: File | Blob,
  collectionId: string,
  did: string,
): Promise<{ file: File | Blob; content: string }> {
  const entityDid = await resolveCollectionEntityDid(collectionId);
  const resource = claimsLaneResource(entityDid, collectionId);
  const name = file instanceof File ? file.name : 'file';
  const path = evidencePath(collectionId, name);

  const uploaded =
    file.size <= VFS_SINGLE_SHOT_MAX_BYTES
      ? await singleShotUpload(file, path, resource, did)
      : await resumableUpload(file, path, resource, did);

  const ref = buildRef(uploaded, file.type || 'application/octet-stream', entityDid, collectionId);
  return { file, content: JSON.stringify(ref) };
}

/**
 * Fetch the decrypted bytes of a VFS claim-media reference (a serviceEndpoint this module
 * produced). The caller must hold lane read access on-chain (Evaluate / own uploads / admin /
 * controller) — the URL itself carries the entity + collection needed to mint the token.
 */
export async function fetchVfsClaimMedia(url: string, did: string): Promise<Blob> {
  const target = parseVfsClaimMediaUrl(url);
  if (!target) throw new Error('Not a VFS claim-media URL');
  const resource = claimsLaneResource(target.entityDid, target.collectionId);
  const bearer = await mintVfsInvocation(did, 'fs/read', resource);
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${bearer}`, 'X-Auth-Type': 'ucan' },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(`Evidence download failed: ${res.status} ${body?.message ?? ''}`.trim());
  }
  return res.blob();
}
