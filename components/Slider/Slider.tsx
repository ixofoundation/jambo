import { FC, HTMLAttributes } from 'react';

import styles from './Slider.module.scss';

type SliderProps = {
  max: number;
  min: number;
  value: number;
} & HTMLAttributes<HTMLInputElement>;

const Slider: FC<SliderProps> = ({ value, max, ...props }) => {
  return (
    <div className={styles.wrapper}>
      <div data-value={value} className={styles.sliderTrack} style={{ width: `${(value / max) * 100}%` }} />
      <input type='range' max={max} value={value} className={styles.slider} {...props} />
    </div>
  );
};

export default Slider;
