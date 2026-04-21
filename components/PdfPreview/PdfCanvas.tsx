import dynamic from 'next/dynamic';

import styles from './PdfPreview.module.scss';

const PdfCanvas = dynamic(
  () =>
    import('./PdfCanvasInner').catch((err) => {
      console.error('[PdfCanvas] dynamic import failed', err);
      throw err;
    }),
  {
    ssr: false,
    loading: () => <div className={styles.canvasLoading}>Loading module…</div>,
  },
);

export default PdfCanvas;
