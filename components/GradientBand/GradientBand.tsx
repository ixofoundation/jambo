import { FC } from 'react';
import styles from './GradientBand.module.scss';

type GradientBandProps = {
  variant: 'purple' | 'blue' | 'green' | 'yellow';
};

const GradientBand: FC<GradientBandProps> = ({ variant }) => (
  <div className={`${styles.band} ${styles[variant]}`} />
);

export default GradientBand;
