import styles from './Header.module.scss';
import { FC } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import HeaderStatusIndicator from '@components/HeaderStatusIndicator/HeaderStatusIndicator';
import { useAppSelector } from '@store/hooks';

type HeaderProps = {
  onGradient?: boolean;
};

const Header: FC<HeaderProps> = ({ onGradient }) => {
  const router = useRouter();
  const avatarUrl = useAppSelector((state) => state.matrixProfile.avatarUrl);

  return (
    <nav className={`${styles.nav}${onGradient ? ` ${styles.onGradient}` : ''}`}>
      <div className={styles.inner}>
        <Link href='/' className={styles.logo} aria-label='Home'>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src='/images/logo.png' alt='Jambo' className={styles.logoImg} />
        </Link>
        <div className={styles.spacer} />
        <HeaderStatusIndicator />
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
      </div>
    </nav>
  );
};

export default Header;
