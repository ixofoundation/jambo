import { FC } from 'react';

import GradientBand from '@components/GradientBand/GradientBand';
import { GRADIENT_COLORS } from '@constants/gradientColors';
import styles from './AuthLayout.module.scss';

type AuthLayoutProps = {
  children: React.ReactNode;
};

const AuthLayout: FC<AuthLayoutProps> = ({ children }) => (
  <div className={styles.page}>
    <GradientBand {...GRADIENT_COLORS.auth}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src='/images/yoma-impacts-exchange-logo.png'
        alt='Yoma Impacts Exchange'
        className={styles.logo}
      />
    </GradientBand>
    <div className={styles.content}>{children}</div>
  </div>
);

export default AuthLayout;
