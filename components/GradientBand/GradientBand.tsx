import { FC } from 'react';
import styles from './GradientBand.module.scss';

type GradientBandProps = {
  variant: 'purple' | 'blue' | 'green' | 'yellow';
  fullScreen?: boolean;
};

const GradientBand: FC<GradientBandProps> = ({ variant, fullScreen }) => (
  <div className={`${styles.band} ${styles[variant]} ${fullScreen ? styles.fullScreen : ''}`} />
);

export default GradientBand;
