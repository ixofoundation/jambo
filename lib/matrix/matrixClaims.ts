import { getMatrixOpenIdToken } from '@utils/matrix';
import { blobToDataURL } from '@utils/encoding';

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
  const openIdToken = await getMatrixOpenIdToken();
  const formData = new FormData();
  formData.append('collection', collectionId);
  formData.append('file', file);

  const res = await fetch(`${CLAIM_BOT_URL}/media/upload`, {
    method: 'POST',
    headers: {
      'x-openid-token': openIdToken,
      'x-did': did,
    },
    body: formData,
  });

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
 * Downloads a file from its serviceEndpoint and returns a data URL
 * suitable for SurveyJS file preview display.
 */
export async function getSurveyFilePreview(rawContent: string, did: string): Promise<string> {
  try {
    const attachment = typeof rawContent === 'string' ? JSON.parse(rawContent) : rawContent;
    const url: string | undefined = attachment?.serviceEndpoint;
    if (!url) return '';

    const openIdToken = await getMatrixOpenIdToken();
    const res = await fetch(url, {
      headers: {
        'x-openid-token': openIdToken,
        'x-did': did,
      },
    });

    if (!res.ok) return '';

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

    const openIdToken = await getMatrixOpenIdToken();
    const res = await fetch(url, {
      headers: {
        'x-openid-token': openIdToken,
        'x-did': did,
      },
    });

    if (!res.ok) return null;

    const blob = await res.blob();
    const mediaType = attachment?.mediaType || blob.type || 'application/octet-stream';
    return { blob, mediaType };
  } catch (err) {
    console.warn('[matrixClaims] getSurveyFileBlob error:', err);
    return null;
  }
}
