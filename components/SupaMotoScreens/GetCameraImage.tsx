import { FC, useCallback, useEffect, useRef, useState } from 'react';
import cls from 'classnames';

import utilsStyles from '@styles/utils.module.scss';
import styles from './SupaMotoScreens.module.scss';
import styles1 from '@styles/stepsPages.module.scss';
import CustomCamera from '@components/CustomCamera/CustomCamera';
import Header from '@components/Header/Header';
import Footer from '@components/Footer/Footer';
import Camera from '@icons/camera.svg';
import Customer from '@icons/customer.svg';
import { StepConfigType, StepDataType, STEPS } from 'types/steps';
import useWindowDimensions from '@hooks/useWindowDimensions';
import { useRenderScreen } from '@hooks/useRenderScreen';
import CustomerIdBack from './CustomerIdBack';
import CustomerId from './CustomerId';
import IconText from '@components/IconText/IconText';

type GetCameraImageProps = {
  onSuccess: (data: StepDataType<STEPS.get_camera_image>) => void;
  onBack?: () => void;
  data?: StepDataType<STEPS.get_camera_image>;
  config: StepConfigType<STEPS.get_camera_image>;
  Width?: number;
  Height?: number;
  header?: string;
};

const GetCameraImage: FC<GetCameraImageProps> = ({ onSuccess, onBack, Width, Height, header }) => {
  const [frame, setFrame] = useState({ width: 0, height: 0 });
  const [capturedData, setCapturedData] = useState<{
    image: string | null,
    height: number,
    width: number
  }>({ image: null, height: 0, width: 0 });
  const cameraRef = useRef<any>();
  const { width, height, footerHeight, headerHeight } = useWindowDimensions();
  const { currentScreen, switchToScreen } = useRenderScreen('camera');
  useEffect(() => {
    return () => cameraRef.current?.stopCamera();
  }, []);
  useEffect(() => {
    if (width && height) {
      const screenWidth = width ?? 250;
      const screenHeight = (height ?? 300) - footerHeight - headerHeight;

      setFrame({
        width: Width && Width <= screenHeight ? Width : screenWidth,
        height: Height && Height <= screenHeight ? Height : screenHeight,
      });
    }
  }, [width, height, footerHeight, headerHeight]);

  const renderScreen = () => {
    switch (currentScreen) {
      case 'camera':
        return (
          <>
            <Header header={header} />

            <main style={{ top: '-60px', position: 'relative' }} >
              <div className={styles.table}>
                <CustomCamera
                  width={width ?? 250}
                  height={(height ?? 300) - footerHeight - headerHeight}
                  frameWidth={300}
                  frameHeight={200}
                  ref={cameraRef}
                />
              </div>
            </main>
            <Footer onBack={routeBack} onBackUrl={onBack ? undefined : ''} onForward={onSubmit} forwardIcon={Camera} />
          </>
        )
      case 'id_front_verification':
        return (
          <div className={styles.onboardingComponent} >
            <IconText title='' Img={Customer} imgSize={30} />
            <div className="div">
              <div style={{
                display: 'flex', justifyContent: 'center', alignItems: 'center'
              }} >
                <div style={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  height: '230px', width: '330px', borderStyle: 'solid', borderRadius: '5px', borderColor: '#E0A714'
                }}>
                  <img src={capturedData.image} alt="Captured Image" width="300" height="200" style={{ borderRadius: '5px' }} />
                </div>
              </div>
              <p style={{ textAlign: 'center' }} >Is the front side photo ok?</p>
            </div>
            <Footer onBack={routeBack} onBackUrl='/' onForward={switchRoute} />
          </div>
        )
      case 'customer_identification_back':
        return <CustomerIdBack />;
      case 'previous_route':
        return <CustomerId />
      default:
        return <>Empty</>;
    }
  }

  const onSubmit = useCallback(() => {
    const imageSrc = cameraRef.current.captureImage();
    if (imageSrc) {
      const result = { image: imageSrc, height: frame.height, width: frame.width };
      setCapturedData(result);
    }
    switchToScreen('id_front_verification');
  }, [cameraRef, frame]);

  const switchRoute = () => {
    switchToScreen('customer_identification_back');
  };

  const routeBack = () => {
    switchToScreen('previous_route');
  };

  return renderScreen()
};

export default GetCameraImage;
