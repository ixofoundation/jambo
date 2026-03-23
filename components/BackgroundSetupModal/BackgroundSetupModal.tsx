import { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { useBackgroundSetup } from '@hooks/useBackgroundSetup';
import MatrixPinForm from '@components/MatrixPinForm/MatrixPinForm';
import Button, { BUTTON_BG_COLOR, BUTTON_COLOR, BUTTON_SIZE } from '@components/Button/Button';
import Loader from '@components/Loader/Loader';
import styles from './BackgroundSetupModal.module.scss';

export default function BackgroundSetupModal() {
  const { status, statusMessage, error, inputRequest, showDetails, setShowDetails, retry, dismiss } =
    useBackgroundSetup();
  const [isBrowser, setIsBrowser] = useState(false);

  useEffect(() => {
    setIsBrowser(true);
  }, []);

  // Nothing to show
  if (!isBrowser) return null;

  // All modal visibility gated behind showDetails (user must click header indicator)
  if (!showDetails || status === 'idle') return null;

  const hasInputRequest = status === 'needs_input' && inputRequest;

  const modalRoot = document.getElementById('modal-root');
  if (!modalRoot) return null;

  // PIN input modal
  if (hasInputRequest && inputRequest.type === 'pin') {
    return ReactDOM.createPortal(
      <div className={styles.overlay}>
        <div className={styles.modal}>
          <div className={styles.card}>
            {/* @ts-ignore */}
            <MatrixPinForm
              encryptedMnemonic={inputRequest.encryptedMnemonic}
              onSuccess={(pin: string) => {
                (inputRequest as any).resolve(pin);
              }}
              onError={(err: string) => {
                (inputRequest as any).reject(new Error(err));
              }}
            />
          </div>
        </div>
      </div>,
      modalRoot,
    );
  }

  // Details/progress/error modal
  return ReactDOM.createPortal(
    <div className={styles.overlay} onClick={() => setShowDetails(false)}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.card}>
          <div className={styles.header}>
            <h2 className={styles.title}>Data Vault Setup</h2>
            <button className={styles.closeButton} onClick={() => setShowDetails(false)}>
              &times;
            </button>
          </div>

          {status === 'running' && (
            <div className={styles.content}>
              <div className={styles.loaderWrap}>
                {/* @ts-ignore */}
                <Loader />
              </div>
              <p className={styles.message}>{statusMessage}</p>
            </div>
          )}

          {status === 'success' && (
            <div className={styles.content}>
              <div className={styles.successIcon}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  <polyline points="9 12 11 14 15 10" />
                </svg>
              </div>
              <p className={styles.message}>Data Vault setup complete</p>
              {/* @ts-ignore */}
              <Button
                label="Done"
                onClick={dismiss}
                color={BUTTON_COLOR.white}
                size={BUTTON_SIZE.mediumLarge}
                bgColor={BUTTON_BG_COLOR.primary}
                style={{ width: '100%', marginTop: '16px' }}
              />
            </div>
          )}

          {status === 'error' && (
            <div className={styles.content}>
              <div className={styles.errorIcon}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <p className={styles.errorMessage}>{error}</p>
              {/* @ts-ignore */}
              <Button
                label="Retry"
                onClick={() => {
                  setShowDetails(false);
                  retry();
                }}
                color={BUTTON_COLOR.white}
                size={BUTTON_SIZE.mediumLarge}
                bgColor={BUTTON_BG_COLOR.primary}
                style={{ width: '100%', marginTop: '16px' }}
              />
            </div>
          )}
        </div>
      </div>
    </div>,
    modalRoot,
  );
}
