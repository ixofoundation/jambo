import { ReactNode } from 'react';

import WarningTriangle from '@icons/warning_triangle.svg';
import styles from './SubclaimModal.module.scss';

export interface SubclaimModalErrorAction {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
}

interface SubclaimModalErrorCardProps {
  message: ReactNode;
  actions?: SubclaimModalErrorAction[];
  className?: string;
}

export default function SubclaimModalErrorCard({ message, actions, className }: SubclaimModalErrorCardProps) {
  return (
    <div className={className ? `${styles.errorCard} ${className}` : styles.errorCard}>
      <div className={styles.errorMessageRow}>
        <span className={styles.errorIcon} aria-hidden='true'>
          <WarningTriangle />
        </span>
        <span className={styles.errorMessage}>{message}</span>
      </div>
      {actions && actions.length > 0 && (
        <div className={styles.errorActions}>
          {actions.map((action, idx) => (
            <button
              key={`${action.label}-${idx}`}
              type='button'
              className={styles.errorActionBtn}
              onClick={action.onClick}
            >
              {action.icon}
              <span>{action.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
