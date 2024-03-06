import { FC, HTMLAttributes, useEffect, useRef } from 'react';
import QRCode from 'react-qr-code';
import { CountdownCircleTimer } from 'react-countdown-circle-timer';
import { isMobile, isIOS, isMacOs } from 'react-device-detect';
import { SIGN_X_CLEAN_DEEPLINK, convertDataToDeeplink } from '@ixo/signx-sdk';

import styles from './SignX.module.scss';
import { getCSSVariable } from '@utils/styles';

type SignXProps = {
  title: string;
  subtitle?: string;
  data: any;
  timeout: number;
  transactSequence?: number;
  isNewSession?: boolean;
} & HTMLAttributes<HTMLDivElement>;

const SignX: FC<SignXProps> = ({ title, subtitle, data, timeout, transactSequence }) => {
  const isNewSession = transactSequence === 1;
  const firstLoad = useRef(false);
  const timeoutFull = (timeout - 1000) / 1000;
  const timeoutThird = timeoutFull / 3;
  const deeplink = convertDataToDeeplink(isNewSession ? data : { type: SIGN_X_CLEAN_DEEPLINK });
  const downloadLink =
    isIOS || isMacOs
      ? `https://apps.apple.com/app/impacts-x/id6444948058`
      : `https://play.google.com/store/apps/details?id=com.ixo.mobile`;

  useEffect(() => {
    if (firstLoad.current) return;
    firstLoad.current = true;

    if (isMobile) {
      console.log('isMobile');
      setTimeout(() => {
        const newWindow = window.open(deeplink, '_top', 'noopener,noreferrer');
        if (newWindow) newWindow.opener = null;
      });
    }
  }, []);

  return (
    <div className={styles.signx}>
      <h2>{title}</h2>
      {!isNewSession ? (
        <p>
          Please open your{' '}
          <a href={downloadLink} rel='noopener noreferrer' target='_blank'>
            Impacts X App
          </a>{' '}
          and sign transaction #{transactSequence}
        </p>
      ) : subtitle ? (
        <p>{subtitle}</p>
      ) : (
        <p>
          Scan QR with your{' '}
          <a href={downloadLink} rel='noopener noreferrer' target='_blank'>
            Impacts X App
          </a>
        </p>
      )}
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
      {isNewSession && (
        <>
          <QRCode value={JSON.stringify(data)} size={250} />
          <p className={styles.deeplink}>
            If you are on a mobile device please install the{' '}
            <a href={downloadLink} rel='noopener noreferrer' target='_blank'>
              Impacts X App
            </a>{' '}
            and then click{' '}
            <a href={deeplink} rel='noopener noreferrer' target='_blank'>
              here
            </a>
            .
          </p>
        </>
      )}
    </div>
  );
};

export default SignX;
