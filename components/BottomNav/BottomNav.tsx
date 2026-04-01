import { FC } from 'react';
import { useRouter } from 'next/router';
import ExploreIcon from 'assets/icons/exploreicon.svg';
import DeedsIcon from 'assets/icons/deedsicon.svg';
import WalletIcon from 'assets/icons/walleticon.svg';
import ProfileIcon from 'assets/icons/profileicon.svg';
import styles from './BottomNav.module.scss';

const BottomNav: FC = () => {
  const router = useRouter();
  const path = router.asPath;

  const isExplore = path === '/' || path.startsWith('/entities');
  const isWallet = path.startsWith('/wallet');
  const isProfile = path.startsWith('/profile');

  return (
    <nav className={styles.nav}>
      <div className={styles.inner}>
        <button
          className={`${styles.item}${isExplore ? ` ${styles.active}` : ''}`}
          onClick={() => router.push('/entities')}
          aria-label="Explore"
        >
          <ExploreIcon />
          <span>Explore</span>
        </button>

        <button className={`${styles.item} ${styles.disabled}`} aria-label="Deeds" disabled>
          <DeedsIcon />
          <span>Deeds</span>
        </button>

        <button
          className={`${styles.item}${isWallet ? ` ${styles.active}` : ''}`}
          onClick={() => router.push('/wallet')}
          aria-label="Wallet"
        >
          <WalletIcon />
          <span>Wallet</span>
        </button>

        <button
          className={`${styles.item}${isProfile ? ` ${styles.active}` : ''}`}
          onClick={() => router.push('/profile')}
          aria-label="Profile"
        >
          <ProfileIcon />
          <span>Profile</span>
        </button>
      </div>
    </nav>
  );
};

export default BottomNav;
