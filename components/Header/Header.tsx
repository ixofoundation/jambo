import styles from './Header.module.scss';
import { FC } from 'react';
import { useDrawer } from '@components/Drawer/Drawer';

type HeaderProps = {
  onBack?: () => void;
};

const Header: FC<HeaderProps> = ({ onBack }) => {
  const { open } = useDrawer();

  return (
    <nav className={styles.nav}>
      <div className={styles.inner}>
        {onBack ? (
          <button
            className={styles.iconButton}
            onClick={onBack}
            aria-label="Go back"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
        ) : (
          <button
            className={styles.iconButton}
            onClick={() => window.location.assign('/')}
            aria-label="Home"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </button>
        )}
        <button
          className={styles.iconButton}
          onClick={open}
          aria-label="Open menu"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
      </div>
    </nav>
  );
};

export default Header;
