import { KeyboardEvent, MouseEvent, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { createRoot } from 'react-dom/client';

import Cross from '@icons/cross.svg';
import styles from './PdfPreview.module.scss';

type PdfPreviewProps = {
  blobUrl: string;
  fileName?: string;
  compact?: boolean;
  onOpen?: () => void;
};

export default function PdfPreview({ blobUrl, fileName, compact, onOpen }: PdfPreviewProps) {
  if (compact) {
    const handleClick = (e: MouseEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      onOpen?.();
    };

    const handleKey = (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onOpen?.();
      }
    };

    return (
      <div
        className={styles.thumbnail}
        role='button'
        tabIndex={0}
        aria-label={fileName ? `Open preview of ${fileName}` : 'Open PDF preview'}
        title={fileName ? `Open ${fileName}` : 'Open PDF'}
        onClick={handleClick}
        onKeyDown={handleKey}
      >
        <span className={styles.thumbnailHint}>PDF</span>
        <iframe className={styles.thumbnailIframe} src={`${blobUrl}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`} title={fileName || 'PDF preview'} />
        {fileName && <span className={styles.thumbnailLabel}>{fileName}</span>}
      </div>
    );
  }

  return <PdfFullViewer blobUrl={blobUrl} fileName={fileName} onClose={() => undefined} />;
}

type PdfFullViewerProps = {
  blobUrl: string;
  fileName?: string;
  onClose: () => void;
};

function PdfFullViewer({ blobUrl, fileName, onClose }: PdfFullViewerProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleBackdrop = (e: MouseEvent | any) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('click', handleBackdrop, true);
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('click', handleBackdrop, true);
      window.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  const content = (
    <div className={styles.overlay}>
      <div className={styles.fullModal} ref={modalRef}>
        <div className={styles.fullHeader}>
          <span className={styles.fullTitle} title={fileName}>
            {fileName || 'PDF'}
          </span>
          <a
            href='#'
            onClick={(e) => {
              e.preventDefault();
              onClose();
            }}
            className={styles.fullClose}
            aria-label='Close preview'
          >
            <Cross color='black' />
          </a>
        </div>
        <iframe className={styles.fullIframe} src={blobUrl} title={fileName || 'PDF'} />
      </div>
    </div>
  );

  if (typeof document === 'undefined') return null;
  const portalTarget = document.getElementById('modal-root');
  if (!portalTarget) return null;
  return ReactDOM.createPortal(content, portalTarget);
}

/**
 * Mount a full-screen PDF preview modal. Returns a function that unmounts it.
 */
export function openPdfModal(blobUrl: string, fileName?: string): () => void {
  if (typeof document === 'undefined') return () => undefined;
  const host = document.getElementById('custom-root');
  if (!host) return () => undefined;
  const root = createRoot(host);
  const close = () => {
    try {
      root.unmount();
    } catch {
      /* ignore */
    }
  };
  root.render(<PdfFullViewer blobUrl={blobUrl} fileName={fileName} onClose={close} />);
  return close;
}
