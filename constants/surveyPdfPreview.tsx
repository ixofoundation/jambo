import { createRoot, Root } from 'react-dom/client';
import type { Model } from 'survey-core';

import PdfPreview, { openPdfModal } from '@components/PdfPreview/PdfPreview';
import { getSurveyFileBlob } from '../lib/matrix/matrixClaims';

type MountEntry = {
  root: Root;
  blobUrl: string;
  container: HTMLElement;
  hiddenElement?: HTMLElement;
  previousDisplay?: string;
};

function isPdfFileItem(item: any): boolean {
  if (!item) return false;
  const typeField = String(item.type || item.mediaType || '').toLowerCase();
  if (typeField === 'application/pdf') return true;
  const content = item.content ?? item;
  if (typeof content === 'string') {
    if (content.startsWith('data:application/pdf')) return true;
    if (content.startsWith('{')) {
      try {
        const parsed = JSON.parse(content);
        if (String(parsed?.mediaType || '').toLowerCase() === 'application/pdf') return true;
      } catch {
        /* ignore */
      }
    }
  }
  return false;
}

async function resolvePdfBlobUrl(item: any, did: string): Promise<string | null> {
  const content = item?.content ?? item;
  if (typeof content === 'string' && content.startsWith('data:application/pdf')) {
    try {
      const res = await fetch(content);
      const blob = await res.blob();
      return URL.createObjectURL(blob);
    } catch (err) {
      console.warn('[surveyPdfPreview] data URL conversion failed', err);
      return null;
    }
  }
  const result = await getSurveyFileBlob(content, did);
  if (!result) return null;
  return URL.createObjectURL(result.blob);
}

function PdfThumbnail({ blobUrl, fileName }: { blobUrl: string; fileName?: string }) {
  const handleOpen = () => {
    openPdfModal(blobUrl, fileName);
  };
  return <PdfPreview blobUrl={blobUrl} fileName={fileName} compact onOpen={handleOpen} />;
}

/**
 * Attaches a handler that renders inline PDF thumbnails inside SurveyJS file
 * questions whose values contain application/pdf attachments. Intended for
 * read-only display contexts (view mode, subclaim sheet).
 *
 * Returns a disposer that removes the handler and cleans up all mounted
 * React roots and blob URLs.
 */
export function createAttachPdfPreviewHandler(did: string): (model: Model) => () => void {
  return (model: Model) => {
    const mountedElements = new WeakSet<HTMLElement>();
    const allMounts: MountEntry[] = [];

    const renderForQuestion = async (question: any, htmlElement: HTMLElement) => {
      if (!question || question.getType?.() !== 'file') return;
      if (mountedElements.has(htmlElement)) return;
      mountedElements.add(htmlElement);

      const rawValue = question.value;
      const items: any[] = Array.isArray(rawValue) ? rawValue : rawValue ? [rawValue] : [];
      const pdfs = items.filter(isPdfFileItem);
      if (pdfs.length === 0) return;

      const anchor =
        htmlElement.querySelector<HTMLElement>('.sd-question__content') ||
        htmlElement.querySelector<HTMLElement>('.sv-question__content') ||
        htmlElement;

      // Hide the default SurveyJS file widget for this question — the thumbnail
      // replaces it. The browser's built-in PDF viewer (opened via the modal)
      // exposes its own download button, so no affordance is lost.
      const fileWidget =
        anchor.querySelector<HTMLElement>('.sd-file') ||
        anchor.querySelector<HTMLElement>('.sv-file') ||
        anchor.querySelector<HTMLElement>('[class*="sd-file"]') ||
        anchor.querySelector<HTMLElement>('[class*="sv-file"]');
      let hiddenElement: HTMLElement | undefined;
      let previousDisplay: string | undefined;
      if (fileWidget) {
        hiddenElement = fileWidget;
        previousDisplay = fileWidget.style.display;
        fileWidget.style.display = 'none';
      }

      const mountHost = document.createElement('div');
      mountHost.setAttribute('data-pdf-mount-host', 'true');
      mountHost.style.display = 'flex';
      mountHost.style.flexWrap = 'wrap';
      mountHost.style.gap = '8px';
      mountHost.style.marginTop = '8px';
      if (hiddenElement && hiddenElement.parentElement) {
        hiddenElement.parentElement.insertBefore(mountHost, hiddenElement);
      } else {
        anchor.appendChild(mountHost);
      }

      let attachedHidden = false;
      for (const item of pdfs) {
        try {
          const blobUrl = await resolvePdfBlobUrl(item, did);
          if (!blobUrl) continue;
          const mountEl = document.createElement('div');
          mountHost.appendChild(mountEl);
          const root = createRoot(mountEl);
          root.render(<PdfThumbnail blobUrl={blobUrl} fileName={item.name} />);
          const entry: MountEntry = { root, blobUrl, container: mountEl };
          if (!attachedHidden && hiddenElement) {
            entry.hiddenElement = hiddenElement;
            entry.previousDisplay = previousDisplay;
            attachedHidden = true;
          }
          allMounts.push(entry);
        } catch (err) {
          console.warn('[surveyPdfPreview] render failed', err);
        }
      }

      // If no PDFs actually rendered, restore the hidden widget so the user
      // isn't left with a blank question.
      if (!attachedHidden && hiddenElement) {
        hiddenElement.style.display = previousDisplay ?? '';
        mountHost.remove();
      }
    };

    const onAfter = (_sender: any, options: any) => {
      if (!options?.question || !options?.htmlElement) return;
      if (options.question.getType?.() !== 'file') return;
      void renderForQuestion(options.question, options.htmlElement);
    };

    model.onAfterRenderQuestion.add(onAfter);

    return () => {
      try {
        model.onAfterRenderQuestion.remove(onAfter);
      } catch {
        /* ignore */
      }
      for (const entry of allMounts) {
        try {
          entry.root.unmount();
        } catch {
          /* ignore */
        }
        try {
          URL.revokeObjectURL(entry.blobUrl);
        } catch {
          /* ignore */
        }
        try {
          entry.container.remove();
        } catch {
          /* ignore */
        }
        if (entry.hiddenElement) {
          try {
            entry.hiddenElement.style.display = entry.previousDisplay ?? '';
          } catch {
            /* ignore */
          }
        }
      }
      allMounts.length = 0;
    };
  };
}
