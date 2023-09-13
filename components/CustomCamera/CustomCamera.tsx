import { forwardRef, Ref, useEffect, useImperativeHandle, useRef } from 'react';

import styles from './CustomCamera.module.scss';

type CustomCameraRef = {
  // startCamera: () => void;
  captureImage: () => string | undefined;
  // stopCamera: () => void;
};

type CustomCameraProps = {
  height: number;
  width: number;
  frameWidth: number;
  frameHeight: number;
};

const CustomCamera = ({ height, width, frameWidth, frameHeight }: CustomCameraProps, ref: Ref<CustomCameraRef>) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | undefined>();

  useEffect(() => {
    startCamera();

    return () => {
      stopStream();
    };
  }, []);

  const stopStream = (stream: MediaStream | undefined = streamRef.current) => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      stream = undefined;
    }
  };

  const capture = () => {
    if (!canvasRef.current || !videoRef.current) return;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    if (!context) return;
    const videoWidth = videoRef.current?.videoWidth ?? 0;
    const videoHeight = videoRef.current?.videoHeight ?? 0;
    const x = videoWidth * 0.5 - frameWidth * 0.5;
    const y = videoHeight * 0.5 - frameHeight * 0.5;
    canvas.width = width;
    canvas.height = height;
    context.drawImage(videoRef.current, x, y, frameWidth, frameHeight, 0, 0, width, height);
    const dataURL = canvas.toDataURL('image/png');
    stopStream();
    return dataURL;
  };

  const captureImage = () => {
    const result = capture();
    stopCamera();
    return result;
  };

  const startCamera = () => {
    navigator.mediaDevices.getUserMedia({ video: true }).then((mediaStream) => {
      if (streamRef.current) stopStream();
      streamRef.current = mediaStream;
      if (videoRef.current) {
        videoRef.current.srcObject = streamRef.current;
        videoRef.current.play();
      }
    });
  };

  const stopCamera = () => {
    if (videoRef.current) {
      stopStream();
      const stream = videoRef.current.srcObject as MediaStream;
      if (stream) {
        stopStream(stream);
        videoRef.current.srcObject = null;
      }
    }
  };

  useImperativeHandle(ref, () => ({
    // startCamera: startCamera, // do not use
    captureImage: captureImage,
    // stopCamera: stopCamera, // do not use
  }));

  return (
    <div className={styles.wrapper} style={{ width, height }}>
      <video ref={videoRef} className={styles.video} />
      <canvas hidden ref={canvasRef} className={styles.canvas} />
      <div
        className={styles.frame}
        style={{
          top: `calc(50% - ${frameHeight * 0.5}px)`,
          left: `calc(50% - ${frameWidth * 0.5}px)`,
          width: frameWidth,
          height: frameHeight,
        }}
      />
    </div>
  );
};

export default forwardRef<CustomCameraRef, CustomCameraProps>(CustomCamera);
