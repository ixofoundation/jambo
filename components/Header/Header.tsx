import styles from './Header.module.scss';
import { FC } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import HeaderStatusIndicator from '@components/HeaderStatusIndicator/HeaderStatusIndicator';
import { useAppSelector } from '@store/hooks';

type HeaderProps = {
  onGradient?: boolean;
  title?: string;
  onClose?: () => void;
  static?: boolean;
};

const Header: FC<HeaderProps> = ({ onGradient, title, onClose, static: isStatic }) => {
  const router = useRouter();
  const avatarUrl = useAppSelector((state) => state.matrixProfile.avatarUrl);
  const isProfile = router.pathname === '/profile';
  const isSettings = router.pathname === '/settings';

  return (
    <nav
      className={`${styles.nav}${onGradient ? ` ${styles.onGradient}` : ''}${
        isStatic ? ` ${styles.static}` : ''
      }`}
    >
      <div className={styles.inner}>
        {title ? (
          <span className={styles.title}>{title}</span>
        ) : (
          <>
            {isSettings ? (
              <span style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>Settings</span>
            ) : (
              <Link href='/' className={styles.logo} aria-label='Home'>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src='/images/logo.png' alt='Jambo' className={styles.logoImg} />
              </Link>
            )}
            <div className={styles.spacer} />
            <HeaderStatusIndicator />
          </>
        )}
        {onClose ? (
          <button className={styles.iconButton} onClick={onClose} aria-label='Close'>
            <svg
              width='20'
              height='20'
              viewBox='0 0 24 24'
              fill='none'
              stroke='currentColor'
              strokeWidth='2'
              strokeLinecap='round'
              strokeLinejoin='round'
            >
              <line x1='18' y1='6' x2='6' y2='18' />
              <line x1='6' y1='6' x2='18' y2='18' />
            </svg>
          </button>
        ) : isProfile ? (
          <button
            className={styles.iconButton}
            onClick={() => router.push('/settings')}
            aria-label='Settings'
          >
            <svg
              width='20'
              height='20'
              viewBox='0 0 24 24'
              fill='none'
              stroke='currentColor'
              strokeWidth='2'
              strokeLinecap='round'
              strokeLinejoin='round'
            >
              <circle cx='12' cy='12' r='3' />
              <path d='M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z' />
            </svg>
          </button>
        ) : (
          <button
            className={`${styles.iconButton} ${styles.profileButton}`}
            onClick={() => router.push('/profile')}
            aria-label='Profile'
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt='Profile' className={styles.profileAvatar} />
            ) : (
              <svg
                width='20'
                height='20'
                viewBox='0 0 24 24'
                fill='none'
                stroke='currentColor'
                strokeWidth='2'
                strokeLinecap='round'
                strokeLinejoin='round'
              >
                <circle cx='12' cy='8' r='4' />
                <path d='M20 21a8 8 0 1 0-16 0' />
              </svg>
            )}
          </button>
        )}
      </div>
    </nav>
  );
};

export default Header;
