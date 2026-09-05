/**
 * Resumable (tus 1.0.0) upload to the IXO Virtual Filesystem — the transport behind large-file
 * (video) claim evidence uploads. One request per part with a FRESH single-use UCAN each
 * (`getBearer` is called per request via tus's `onBeforeRequest`), resume-after-disconnect
 * within an attempt, and the created file's coordinates read off the final PATCH's response
 * headers. Worker contract: ixo-virtual-filesystem RESUMABLE_UPLOADS.md.
 */

/** Single-shot uploads up to this size; larger files go resumable. Well under the ~100 MB
 *  Cloudflare Pro edge cap either way — the line just marks where tus's extra requests start
 *  buying resumability that matters (field connections, video). */
export const VFS_SINGLE_SHOT_MAX_BYTES = 8 * 1024 * 1024;
/** tus part size: multiple of 64 KiB and ≥ 5 MiB per the worker's part rules; 32 MiB balances
 *  request count against retry cost and stays far under the edge cap. */
export const VFS_TUS_CHUNK_BYTES = 32 * 1024 * 1024;

export interface TusUploadResult {
  id: string;
  cid: string;
  path: string;
}

/**
 * Upload one file resumably and resolve with the created file's coordinates.
 * tus-js-client is loaded lazily — it only ever ships to browsers that pick a large file.
 */
export async function tusUploadToVfs({
  baseUrl,
  path,
  file,
  mimeType,
  getBearer,
}: {
  baseUrl: string;
  path: string;
  file: File | Blob;
  mimeType: string;
  /** Fresh single-use bearer per HTTP request (creation, every part, HEAD probes). */
  getBearer: () => Promise<string>;
}): Promise<TusUploadResult> {
  const { Upload } = await import('tus-js-client');

  return new Promise<TusUploadResult>((resolve, reject) => {
    // The final PATCH answers with the created file's coordinates.
    let fileId = '';
    let cid = '';
    const upload = new Upload(file, {
      endpoint: `${baseUrl}/api/fs/upload`,
      chunkSize: VFS_TUS_CHUNK_BYTES,
      metadata: { path, contentType: mimeType },
      // Every attempt targets a fresh unique path (claims lane is write-once), so a resume
      // against a PREVIOUS attempt's session can never succeed — don't persist fingerprints.
      storeFingerprintForResuming: false,
      retryDelays: [0, 1000, 3000, 5000],
      onBeforeRequest: async (req) => {
        req.setHeader('Authorization', `Bearer ${await getBearer()}`);
        req.setHeader('X-Auth-Type', 'ucan');
      },
      onAfterResponse: (_req, res) => {
        fileId = res.getHeader('X-Vfs-File-Id') || fileId;
        cid = res.getHeader('X-Vfs-Cid') || cid;
      },
      onError: (err) => reject(err instanceof Error ? err : new Error(String(err))),
      onSuccess: () => {
        if (!fileId || !cid) {
          reject(new Error('Resumable upload completed but the file reference is missing'));
          return;
        }
        resolve({ id: fileId, cid, path });
      },
    });
    upload.start();
  });
}
