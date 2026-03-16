import { HTMLAttributes } from 'react';

import styles from './Loader.module.scss';

type LoaderProps = {
  size?: number;
} & HTMLAttributes<HTMLDivElement>;

const Loader = ({ size = 50, className, ...other }: LoaderProps) => {
  return (
    <div
      className={styles.tailSpin}
      style={{ width: size, height: size, borderWidth: 0.1 * size < 2 ? 2 : 0.1 * size }}
    />
  );
};

export default Loader;
