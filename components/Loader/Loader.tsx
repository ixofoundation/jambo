import { HTMLAttributes } from 'react';
// import { TailSpin } from 'react-loader-spinner';
// import { getCSSVariable } from '@utils/styles';

import styles from './Loader.module.scss';

type LoaderProps = {
  size?: number;
} & HTMLAttributes<HTMLDivElement>;

const Loader = ({ size = 50, className, ...other }: LoaderProps) => {
  // const primaryColor = getCSSVariable('--primary-color');

  return (
    <div
      className={styles.tailSpin}
      style={{ width: size, height: size, borderWidth: 0.1 * size < 2 ? 2 : 0.1 * size }}
    />
  );
  // return <TailSpin height={size} width={size} color={primaryColor ?? '#000'} wrapperClass={className} />;
};

export default Loader;
