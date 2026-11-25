import { Model, QuestionFileModel } from 'survey-core';
import { uploadFile, getSurveyFilePreview } from '../lib/matrix/matrixClaims';
import { uploadClaimFileToVfs } from '../lib/vfs/claimMedia';
import { hasVfsSigner } from '@utils/ucanVfs';
import { heldFilePreview, holdFile, isNetworkFailure } from '../lib/pwa/outbox/heldFiles';
import { track } from '../lib/analytics/client';
import { AnalyticsEvents } from '../lib/analytics/events';

/**
 * Configures all file-type questions on the model for external upload:
 * - storeDataAsText = false  → triggers onUploadFiles instead of base64 embedding
 * - waitForUpload = true     → blocks form completion until uploads finish
 * - showPreview = true       → shows file thumbnail/preview
 */
export function configureFileQuestions(model: Model): void {
  for (const q of model.getAllQuestions()) {
    if (q.getType() === 'file') {
      const fq = q as QuestionFileModel;
      fq.storeDataAsText = false;
      fq.waitForUpload = true;
      fq.showPreview = true;
      allowVideo(fq);
    }
  }
}

/** The VFS object ceiling (R2 single-object limit) — the only size limit evidence has now. */
const VFS_MAX_UPLOAD_BYTES = 5 * 1024 * 1024 * 1024;

/**
 * Video evidence is supported now (VFS claims lane, resumable uploads up to 5 GiB), but claim
 * templates were authored when the claims bot rejected video outright and capped uploads at
 * 10 MB. Widen media (image) accept lists to include video and lift size caps below the VFS
 * ceiling. Document-only questions (e.g. `application/pdf`) are left as authored.
 */
function allowVideo(fq: QuestionFileModel): void {
  const accepted = (fq.acceptedTypes || '').trim();
  if (accepted && /image/i.test(accepted) && !/video/i.test(accepted)) {
    fq.acceptedTypes = `${accepted},video/*`;
  }
  if (fq.maxSize > 0 && fq.maxSize < VFS_MAX_UPLOAD_BYTES) {
    fq.maxSize = VFS_MAX_UPLOAD_BYTES;
  }
}

/**
 * Returns a function that attaches the onUploadFiles handler to a model.
 * Images are compressed before upload. New evidence goes to the VFS claims lane (video-capable
 * via resumable uploads — lib/vfs/claimMedia.ts); the claims bot (Matrix media) remains only as
 * the fallback when no UCAN signing key is available. Reads branch on the stored reference's
 * URL shape, so claims whose media still lives in Matrix keep working.
 */
export function createAttachUploadHandler(
  collectionId: string,
  did: string,
  opts: {
    /**
     * Registers the user's ed25519 signing key on their IID document if it isn't yet (one signed
     * tx the very first time) — the VFS verifies every upload's UCAN against the DID document.
     * Runs once per form, before the first VFS upload. If it fails (e.g. the user declines to
     * sign) the upload falls back to the claims bot for this form.
     */
    ensureVfsSigner?: () => Promise<void>;
    /**
     * Keep a file on the phone when there is no connection to upload it, instead of failing
     * (lib/pwa/outbox). Only for forms the offline queue can send: plain claims. The answer
     * gets a placeholder that is uploaded before the claim is signed.
     */
    holdWhenOffline?: { address: string; onHeld?: () => void };
  } = {},
): (model: Model) => void {
  return (model: Model) => {
    let signerReady: Promise<boolean> | null = null;
    const vfsReady = (): Promise<boolean> => {
      if (!hasVfsSigner()) return Promise.resolve(false);
      if (!signerReady) {
        signerReady = (opts.ensureVfsSigner ? opts.ensureVfsSigner() : Promise.resolve())
          .then(() => true)
          .catch((err) => {
            console.warn('[surveyDefaultConfig] VFS signing key not registered, using claims bot for uploads:', err);
            signerReady = null; // retry on the next upload
            return false;
          });
      }
      return signerReady;
    };

    model.onUploadFiles.add(async (_sender, options) => {
      try {
        const results: Array<{ file: File | Blob; content: string }> = [];
        const hold = opts.holdWhenOffline;
        const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
        // Offline: skip the signing-key check, which needs the chain, and hold every file.
        const useVfs = hold && offline ? false : await vfsReady();

        for (const file of options.files) {
          let fileToUpload: File | Blob = file;

          if (file.type.startsWith('image/')) {
            try {
              const mod = await import('browser-image-compression');
              const imageCompression = mod.default || (mod as any);
              const compressed: Blob = await imageCompression(file, {
                maxSizeMB: 2,
                maxWidthOrHeight: 1920,
                useWebWorker: true,
                initialQuality: 0.8,
                fileType: file.type,
              });
              fileToUpload = new File([compressed], file.name, { type: file.type });
            } catch (compErr) {
              console.warn('[surveyDefaultConfig] Image compression failed, uploading original:', compErr);
            }
          }

          if (hold && offline) {
            results.push({ file, content: await holdFile(fileToUpload, hold.address, collectionId) });
            track(AnalyticsEvents.PwaFileHeld, { collectionId });
            hold.onHeld?.();
            continue;
          }
          try {
            const result = useVfs
              ? await uploadClaimFileToVfs(fileToUpload, collectionId, did)
              : await uploadFile(fileToUpload, collectionId, did);
            results.push(result);
          } catch (uploadErr) {
            if (!hold || !isNetworkFailure(uploadErr)) throw uploadErr;
            results.push({ file, content: await holdFile(fileToUpload, hold.address, collectionId) });
            track(AnalyticsEvents.PwaFileHeld, { collectionId });
            hold.onHeld?.();
          }
        }

        options.callback(
          'success',
          results.map((r) => ({ file: r.file, content: r.content })),
        );
      } catch (err) {
        console.error('[surveyDefaultConfig] Upload failed:', err);
        options.callback('error');
      }
    });
  };
}

/**
 * Returns a function that attaches the onDownloadFile handler to a model.
 * Fetches file from serviceEndpoint and returns a data URL for preview.
 */
export function createAttachDownloadHandler(did: string): (model: Model) => void {
  return (model: Model) => {
    model.onDownloadFile.add(async (_sender, options) => {
      try {
        const raw = options.content || options.fileValue;

        // A file kept on the phone while offline (lib/pwa/outbox): preview it from there.
        const held = await heldFilePreview(typeof raw === 'string' ? raw : raw?.content);
        if (held) {
          options.callback('success', held);
          return;
        }

        // If content is already a data URL (legacy storeDataAsText=true format),
        // return it directly — no need to fetch from claim bot
        if (typeof raw === 'string' && raw.startsWith('data:')) {
          options.callback('success', raw);
          return;
        }

        const dataUrl = await getSurveyFilePreview(raw, did);
        if (dataUrl) {
          options.callback('success', dataUrl);
        } else {
          options.callback('error');
        }
      } catch (err) {
        console.warn('[surveyDefaultConfig] Download failed:', err);
        options.callback('error');
      }
    });
  };
}
