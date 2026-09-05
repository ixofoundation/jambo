import { Model, QuestionFileModel } from 'survey-core';
import { uploadFile, getSurveyFilePreview } from '../lib/matrix/matrixClaims';
import { uploadClaimFileToVfs } from '../lib/vfs/claimMedia';
import { hasVfsSigner } from '@utils/ucanVfs';

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
    }
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
): (model: Model) => void {
  return (model: Model) => {
    model.onUploadFiles.add(async (_sender, options) => {
      try {
        const results: Array<{ file: File | Blob; content: string }> = [];

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

          const result = hasVfsSigner()
            ? await uploadClaimFileToVfs(fileToUpload, collectionId, did)
            : await uploadFile(fileToUpload, collectionId, did);
          results.push(result);
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
