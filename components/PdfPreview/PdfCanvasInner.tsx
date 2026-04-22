import { useEffect, useRef, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';

import styles from './PdfPreview.module.scss';

if (typeof window !== 'undefined') {
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
  console.debug('[PdfCanvas] worker configured', {
    workerSrc: pdfjs.GlobalWorkerOptions.workerSrc,
    pdfjsVersion: pdfjs.version,
  });
}

type PdfCanvasInnerProps = {
  blobUrl: string;
  compact?: boolean;
  width?: number;
};

export default function PdfCanvasInner({ blobUrl, compact, width }: PdfCanvasInnerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [measuredWidth, setMeasuredWidth] = useState<number>(0);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (compact) return;
    if (!containerRef.current || typeof ResizeObserver === 'undefined') return;
    const node = containerRef.current;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect) setMeasuredWidth(Math.max(0, Math.floor(rect.width)));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [compact]);

  if (hasError) {
    return <div className={styles.canvasError}>Preview unavailable</div>;
  }

  const pageWidth = compact ? width ?? 160 : measuredWidth || undefined;

  return (
    <div ref={containerRef} className={compact ? styles.canvasCompact : styles.canvasFull}>
      <Document
        file={blobUrl}
        onLoadSuccess={({ numPages: n }) => {
          console.debug('[PdfCanvas] document loaded', { numPages: n });
          setNumPages(n);
        }}
        onLoadError={(err) => {
          console.error('[PdfCanvas] document load error', err);
          setHasError(true);
        }}
        onSourceError={(err) => {
          console.error('[PdfCanvas] source error', err);
          setHasError(true);
        }}
        loading={<div className={styles.canvasLoading}>Rendering…</div>}
        error={<div className={styles.canvasError}>Preview unavailable</div>}
        noData={<div className={styles.canvasError}>No PDF data</div>}
      >
        {compact ? (
          <Page
            pageNumber={1}
            width={pageWidth}
            renderTextLayer={false}
            renderAnnotationLayer={false}
          />
        ) : (
          Array.from({ length: numPages }, (_, i) => (
            <div key={i + 1} className={styles.canvasPage}>
              <Page
                pageNumber={i + 1}
                width={pageWidth}
                renderTextLayer={false}
                renderAnnotationLayer={false}
              />
            </div>
          ))
        )}
      </Document>
    </div>
  );
}
