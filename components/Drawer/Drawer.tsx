import { createContext, useContext, useState, useCallback, useEffect, FC, HTMLAttributes } from 'react';
import styles from './Drawer.module.scss';

interface DrawerContextType {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

const DrawerContext = createContext<DrawerContextType>({
  isOpen: false,
  open: () => {},
  close: () => {},
});

export const useDrawer = () => useContext(DrawerContext);

export const DrawerProvider: FC<HTMLAttributes<HTMLDivElement>> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  return (
    <DrawerContext.Provider value={{ isOpen, open, close }}>
      {children}
    </DrawerContext.Provider>
  );
};

interface DrawerProps {
  onNavigate: (path: string) => void;
  currentPath: string;
  displayName?: string | null;
  avatarUrl?: string | null;
}

export const Drawer: FC<DrawerProps> = ({ onNavigate, currentPath, displayName, avatarUrl }) => {
  const { isOpen, close } = useDrawer();

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  const isHome = currentPath.startsWith('/entities');
  const isSettings = currentPath === '/settings';
  const isProfile = currentPath === '/profile';

  function handleNav(path: string) {
    close();
    onNavigate(path);
  }

  return (
    <>
      <div
        className={`${styles.overlay} ${isOpen ? styles.open : ''}`}
        onClick={close}
      />
      <button className={`${styles.closeButton} ${isOpen ? styles.closeButtonVisible : ''}`} onClick={close}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
      <div className={`${styles.drawer} ${isOpen ? styles.open : ''}`}>
        <div className={styles.drawerHeader} />
        <div className={styles.menuList}>
          {/* Home */}
          <button
            className={`${styles.menuItem} ${isHome ? styles.active : ''}`}
            onClick={() => handleNav('/')}
          >
            <span className={styles.menuIcon}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </span>
            <span className={styles.menuLabel}>Home</span>
          </button>

          {/* Settings */}
          <button
            className={`${styles.menuItem} ${isSettings ? styles.active : ''}`}
            onClick={() => handleNav('/settings')}
          >
            <span className={styles.menuIcon}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </span>
            <span className={styles.menuLabel}>Settings</span>
          </button>
        </div>
        <div className={styles.drawerBody} />
        <div className={styles.drawerFooter}>
          {/* Profile */}
          <button
            className={`${styles.menuItem} ${isProfile ? styles.active : ''}`}
            onClick={() => handleNav('/profile')}
          >
            <span className={styles.menuIcon}>
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className={styles.menuAvatar} />
              ) : (
                <div className={styles.menuAvatarPlaceholder}>
                  {displayName ? displayName.charAt(0).toUpperCase() : '?'}
                </div>
              )}
            </span>
            <span className={styles.menuLabel}>{displayName || 'Profile'}</span>
          </button>
        </div>
      </div>
    </>
  );
};

export const PageWrapper: FC<HTMLAttributes<HTMLDivElement>> = ({ children }) => {
  const { isOpen } = useDrawer();

  return (
    <div className={`${styles.pageWrapper} ${isOpen ? styles.pushed : ''}`}>
      {children}
    </div>
  );
};
