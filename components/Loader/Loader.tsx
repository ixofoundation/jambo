import styles from './Loader.module.scss';

type LoaderProps = {
  size?: number;
};

const Loader = ({ size = 50 }: LoaderProps) => {
  return (
    <div
      className={styles.tailSpin}
      style={{ width: size, height: size, borderWidth: 0.1 * size < 2 ? 2 : 0.1 * size }}
    />
  );
};

export default Loader;
