import { useBackgroundSetup } from '@hooks/useBackgroundSetup';
import styles from './HeaderStatusIndicator.module.scss';

export default function HeaderStatusIndicator() {
  const { status, setShowDetails } = useBackgroundSetup();

  if (status === 'idle') return null;

  return (
    <button
      className={styles.indicator}
      onClick={() => setShowDetails(true)}
      aria-label="Background setup status"
    >
      {status === 'running' && (
        <div className={styles.spinner} />
      )}

      {status === 'needs_input' && (
        <div className={styles.pulse}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
      )}

      {status === 'success' && (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <polyline points="9 12 11 14 15 10" />
        </svg>
      )}

      {status === 'error' && (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      )}
    </button>
  );
}
