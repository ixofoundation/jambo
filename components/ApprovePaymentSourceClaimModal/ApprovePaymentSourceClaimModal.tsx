import ReactDOM from 'react-dom';

import Cross from '@icons/cross.svg';
import styles from '@components/SubclaimModal/SubclaimModal.module.scss';
import SubclaimModalErrorCard from '@components/SubclaimModal/SubclaimModalErrorCard';

export type ApprovePaymentModalPhase =
  | { kind: 'loading'; message?: string }
  | { kind: 'error'; message: string };

interface ApprovePaymentSourceClaimModalProps {
  open: boolean;
  phase: ApprovePaymentModalPhase;
  onClose: () => void;
}

export default function ApprovePaymentSourceClaimModal({
  open,
  phase,
  onClose,
}: ApprovePaymentSourceClaimModalProps) {
  if (!open) return null;
  const portalRoot = typeof document !== 'undefined' ? document.getElementById('modal-root') : null;
  if (!portalRoot) return null;

  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose();
  }

  return ReactDOM.createPortal(
    <div className={styles.overlay} role='dialog' aria-modal='true' onClick={handleBackdropClick}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2 className={styles.title}>Approve Payment</h2>
          <div className={styles.headerActions}>
            <button type='button' className={styles.iconBtn} onClick={onClose} aria-label='Close'>
              <Cross color='currentColor' />
            </button>
          </div>
        </div>

        <div className={`${styles.body} ${styles.listBody}`}>
          {phase.kind === 'loading' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: 24 }}>
              <div className={styles.spinner}>
                <div className={styles.spinnerInner} />
              </div>
              {phase.message && (
                <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center' }}>
                  {phase.message}
                </p>
              )}
            </div>
          )}

          {phase.kind === 'error' && <SubclaimModalErrorCard message={phase.message} />}
        </div>
      </div>
    </div>,
    portalRoot,
  );
}
