import { HTMLAttributes } from 'react';
import QRCode from 'react-qr-code';
import { CountdownCircleTimer } from 'react-countdown-circle-timer';

import styles from './SignX.module.scss';
import { getCSSVariable } from '@utils/styles';

type SignXProps = {
  title: string;
  subtitle: string;
  data: string;
  timeout: number;
} & HTMLAttributes<HTMLDivElement>;

const SignX = ({ title, subtitle, data, timeout }: SignXProps) => {
  const timeoutFull = (timeout - 1000) / 1000;
  const timeoutThird = timeoutFull / 3;

  return (
    <div className={styles.signx}>
      <h2>{title}</h2>
      <p>{subtitle}</p>
      <div className={styles.timeWrapper}>
        <CountdownCircleTimer
          isPlaying
          duration={timeoutFull}
          colors={[getCSSVariable('--primary-color') || ('#004777' as any), '#F7B801', '#A30000']}
          colorsTime={[timeoutFull, timeoutThird, 0]}
          size={75}
          strokeWidth={5}
        >
          {({ remainingTime, color }) => (
            <div className={styles.time} style={{ color: color }}>
              <div>{remainingTime}</div>
              <p>seconds</p>
            </div>
          )}
        </CountdownCircleTimer>
      </div>
      <QRCode value={data} size={250} />
    </div>
  );
};

export default SignX;
