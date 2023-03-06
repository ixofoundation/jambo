import styles from './Banner.module.scss';

type BannerProps = {
  label: string;
  display: boolean;
};

const Banner = ({ label, display }: BannerProps) => {
  if (!display) return null;

  return <div className={styles.banner}>{label}</div>;
};

export default Banner;
