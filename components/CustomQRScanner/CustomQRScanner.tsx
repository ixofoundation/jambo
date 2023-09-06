import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';

import styles from './CustomQRScanner.module.scss';
import useModalState from '@hooks/useModalState';

type CustomQRScannerProps = {
  width: number;
  height: number;
  fps: number;
  size: number;
  validate?: number | ((data: string) => boolean);
  onSuccess: (data: string) => void;
  onError: (error: Error) => void;
};

const CustomQRScanner = ({
  width = 250,
  height = 250,
  fps = 1,
  size = 250,
  validate = 1,
  onSuccess,
  onError,
}: CustomQRScannerProps) => {
  const [loading, showLoading, hideLoading] = useModalState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | undefined>();

  const stopStream = (stream: MediaStream | undefined = streamRef.current) => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      stream = undefined;
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current?.getContext('2d', { willReadFrequently: true });

    if (videoRef.current) {
      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }).then(function (mediaStream) {
        if (streamRef.current) stopStream();
        streamRef.current = mediaStream;
        if (videoRef.current) {
          videoRef.current.srcObject = streamRef.current;
          videoRef.current.setAttribute('playsinline', 'true'); // required to tell iOS safari we don't want fullscreen
          videoRef.current.play();
          requestAnimationFrame(tick);
        }
      });

      function tick() {
        if (videoRef.current && videoRef.current?.readyState === videoRef.current?.HAVE_ENOUGH_DATA) {
          hideLoading();
          canvasRef.current?.removeAttribute('hidden');

          if (!canvasRef.current) return onError(new Error('No canvas'));
          const videoWidth = videoRef.current?.videoWidth ?? 0;
          const videoHeight = videoRef.current?.videoHeight ?? 0;
          canvasRef.current.height = height;
          canvasRef.current.width = width;
          const x = videoWidth * 0.5 - size * 0.5;
          const y = videoHeight * 0.5 - size * 0.5;
          canvas?.drawImage(videoRef.current, x, y, size, size, 0, 0, width, height);
          const imageData = canvas?.getImageData(0, 0, width, height);

          if (!imageData) return onError(new Error('No image data'));

          const code = jsQR(imageData?.data, imageData?.width, imageData?.height, {
            inversionAttempts: 'dontInvert',
          });

          if (code?.data) {
            const valid =
              validate && typeof validate === 'function' ? validate(code.data) : code.data.length >= validate;
            if (valid) {
              onSuccess(code.data);
              stopStream();
            }
          }
        }
        if (streamRef.current) setTimeout(() => requestAnimationFrame(tick), 1000 / fps);
      }
    }

    return () => {
      stopStream();
    };
  }, [videoRef.current, canvasRef.current]);

  return (
    <div className={styles.wrapper} style={{ width, height }}>
      {!!loading ? (
        <div className={styles.loading}>
          <div>⌛ Loading camera...</div>
        </div>
      ) : (
        <div
          className={styles.frame}
          style={{
            top: `calc(50% - ${size * 0.5}px)`,
            left: `calc(50% - ${size * 0.5}px)`,
            width: size,
            height: size,
          }}
        />
      )}
      <canvas hidden ref={canvasRef} className={styles.canvas} style={{ width: size, height: size }}></canvas>
      <video className={styles.video} ref={videoRef}></video>
    </div>
  );
};

export default CustomQRScanner;
