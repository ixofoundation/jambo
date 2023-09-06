import { FC, useCallback, useEffect, useRef, useState } from 'react';
import cls from 'classnames';

import utilsStyles from '@styles/utils.module.scss';
import styles from '@styles/stepsPages.module.scss';
import CustomCamera from '@components/CustomCamera/CustomCamera';
import Header from '@components/Header/Header';
import Footer from '@components/Footer/Footer';
import Camera from '@icons/camera.svg';
import { StepConfigType, StepDataType, STEPS } from 'types/steps';
import useWindowDimensions from '@hooks/useWindowDimensions';

type GetCameraImageProps = {
  onSuccess: (data: StepDataType<STEPS.get_camera_image>) => void;
  onBack?: () => void;
  data?: StepDataType<STEPS.get_camera_image>;
  config: StepConfigType<STEPS.get_camera_image>;
  header?: string;
};

const GetCameraImage: FC<GetCameraImageProps> = ({ onSuccess, onBack, config, data, header }) => {
  const [frame, setFrame] = useState({ width: 0, height: 0 });
  const cameraRef = useRef<any>();
  const { width, height, footerHeight, headerHeight } = useWindowDimensions();

  useEffect(() => {
    return () => cameraRef.current?.stopCamera();
  }, []);

  useEffect(() => {
    if (width && height) {
      const screenWidth = width ?? 250;
      const screenHeight = (height ?? 300) - footerHeight - headerHeight;

      setFrame({
        width: config.width && config.width <= screenHeight ? config.width : screenWidth,
        height: config.height && config.height <= screenHeight ? config.height : screenHeight,
      });
    }
  }, [width, height, footerHeight, headerHeight]);

  const onSubmit = useCallback(() => {
    const imageSrc = cameraRef.current.captureImage();
    if (imageSrc) {
      const result = { image: imageSrc, height: frame.height, width: frame.width };
      onSuccess(result);
    }
  }, [cameraRef, frame]);

  return (
    <>
      <Header header={header} />

      <main className={cls(utilsStyles.main, styles.bare, utilsStyles.columnJustifyCenter, styles.stepContainer)}>
        <CustomCamera
          width={width ?? 250}
          height={(height ?? 300) - footerHeight - headerHeight}
          frameWidth={frame.width}
          frameHeight={frame.height}
          ref={cameraRef}
        />
      </main>

      <Footer onBack={onBack} onBackUrl={onBack ? undefined : ''} onForward={onSubmit} forwardIcon={Camera} />
    </>
  );
};

export default GetCameraImage;
