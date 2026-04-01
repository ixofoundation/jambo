import styles from './Header.module.scss';
import { FC } from 'react';
import Link from 'next/link';
import HeaderStatusIndicator from '@components/HeaderStatusIndicator/HeaderStatusIndicator';

type HeaderProps = {
  onGradient?: boolean;
};

const Header: FC<HeaderProps> = ({ onGradient }) => {
  return (
    <nav className={`${styles.nav}${onGradient ? ` ${styles.onGradient}` : ''}`}>
      <div className={styles.inner}>
        <Link href='/' className={styles.logo} aria-label='Home'>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src='/images/logo.png' alt='Jambo' className={styles.logoImg} />
        </Link>
        <div className={styles.spacer} />
        <HeaderStatusIndicator />
      </div>
    </nav>
  );
};

export default Header;
