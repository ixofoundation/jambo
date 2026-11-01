import { fetchWithMatrixOpenIdRetry } from '@utils/matrix';
import { blobToDataURL } from '@utils/encoding';
import { resolveBoundServiceDid } from '@utils/serviceDid';
import { claimBotUcanHeaders } from '@utils/ucanClaimBot';

import { fetchVfsClaimMedia, parseVfsClaimMediaUrl } from '../vfs/claimMedia';

const CLAIM_BOT_URL = process.env.NEXT_PUBLIC_MATRIX_CLAIM_BOT_URL!;

/**
 * Uploads a file to the claim bot media endpoint and returns a SurveyJS-compatible
 * result with the JSON-stringified mediaAttachment as `content`.
 */
export async function uploadFile(
  file: File | Blob,
  collectionId: string,
  did: string,
): Promise<{ file: File | Blob; content: string }> {
  const formData = new FormData();
  formData.append('collection', collectionId);
  formData.append('file', file);

  const res = await fetchWithMatrixOpenIdRetry((openIdToken) =>
    fetch(`${CLAIM_BOT_URL}/media/upload`, {
      method: 'POST',
      headers: {
        'x-openid-token': openIdToken,
        'x-did': did,
      },
      body: formData,
    }),
  );

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(`Media upload failed: ${res.status} ${data?.message ?? data?.error ?? res.statusText}`);
  }

  const json = await res.json();
  const cid: string = json?.data?.cid;
  if (!cid) throw new Error('Media upload response missing CID');

  const mediaAttachment = {
    id: `{id}#${cid}`,
    type: 'mediaAttachment',
    proof: cid,
    encrypted: true,
    mediaType: file.type,
    description: '',
    serviceEndpoint: `${CLAIM_BOT_URL}/media/collections/${collectionId}/${cid}`,
  };

  return { file, content: JSON.stringify(mediaAttachment) };
}

/**
 * Reads a legacy (not VFS) claim media link. The serviceEndpoint is written by the claim's
 * submitter, so it is untrusted: it never gets the viewer's Matrix OpenID token. A host that
 * presents its own did:web gets a UCAN only that host accepts; there is no host allowlist, so
 * claims bots on other homeservers keep working. Any other https host is asked with no
 * credential, and anything else is not asked at all (null).
 */
async function fetchLegacyClaimMedia(url: string, did: string): Promise<Response | null> {
  let protocol: string;
  try {
    protocol = new URL(url).protocol;
  } catch {
    return null;
  }
  if (protocol !== 'https:') return null;

  const serviceDid = await resolveBoundServiceDid(url);
  const headers = serviceDid ? await claimBotUcanHeaders(did, serviceDid).catch(() => undefined) : undefined;
  return fetch(url, {
    headers,
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
    // The token is bound to this host: a real bot serves the bytes itself.
    redirect: headers ? 'error' : 'follow',
  });
}

/**
 * Downloads a file from its serviceEndpoint and returns a data URL
 * suitable for SurveyJS file preview display.
 */
export async function getSurveyFilePreview(rawContent: string, did: string): Promise<string> {
  try {
    const attachment = typeof rawContent === 'string' ? JSON.parse(rawContent) : rawContent;
    const url: string | undefined = attachment?.serviceEndpoint;
    if (!url) return '';

    // VFS claims-lane reference on the configured VFS host → fetch from the VFS with a fresh
    // lane-scoped UCAN; any other URL takes the legacy path, so claims whose media still lives
    // in Matrix stay readable forever.
    if (parseVfsClaimMediaUrl(url)) {
      return await blobToDataURL(await fetchVfsClaimMedia(url, did));
    }

    const res = await fetchLegacyClaimMedia(url, did);
    if (!res?.ok) return '';

    const blob = await res.blob();
    return await blobToDataURL(blob);
  } catch (err) {
    console.warn('[matrixClaims] getSurveyFilePreview error:', err);
    return '';
  }
}

/**
 * Downloads a file from its serviceEndpoint and returns the raw Blob + metadata.
 * Used for previews (e.g. PDFs) that need a blob URL rather than a data URL.
 */
export async function getSurveyFileBlob(
  rawContent: unknown,
  did: string,
): Promise<{ blob: Blob; mediaType: string } | null> {
  try {
    const attachment = typeof rawContent === 'string' ? JSON.parse(rawContent) : rawContent;
    const url: string | undefined = attachment?.serviceEndpoint;
    if (!url) return null;

    // VFS claims-lane reference → VFS; anything else → legacy claims-bot path (see above).
    if (parseVfsClaimMediaUrl(url)) {
      const blob = await fetchVfsClaimMedia(url, did);
      return { blob, mediaType: attachment?.mediaType || blob.type || 'application/octet-stream' };
    }

    const res = await fetchLegacyClaimMedia(url, did);
    if (!res?.ok) return null;

    const blob = await res.blob();
    const mediaType = attachment?.mediaType || blob.type || 'application/octet-stream';
    return { blob, mediaType };
  } catch (err) {
    console.warn('[matrixClaims] getSurveyFileBlob error:', err);
    return null;
  }
}
