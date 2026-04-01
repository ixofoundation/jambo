import { FC } from 'react';
import styles from './GradientBand.module.scss';

type GradientBandProps = {
  variant: 'purple' | 'blue' | 'green' | 'yellow';
  fullScreen?: boolean;
  children?: React.ReactNode;
};

const GradientBand: FC<GradientBandProps> = ({ variant, fullScreen, children }) => (
  <div className={`${styles.band} ${styles[variant]} ${fullScreen ? styles.fullScreen : ''}`}>
    {children}
  </div>
);

export default GradientBand;
