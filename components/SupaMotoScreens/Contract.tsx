import React, { FC, useCallback, useEffect, useRef, useState } from 'react'
import Pen from '@icons/pen.svg';
import ContractSvg from '@icons/contract.svg';
import styles from './SupaMotoScreens.module.scss';
import IconText from '@components/IconText/IconText';
import { useRenderScreen } from '@hooks/useRenderScreen';
import useWindowDimensions from '@hooks/useWindowDimensions';
import { StepConfigType, StepDataType, STEPS } from 'types/steps';
import Header from '@components/Header/Header';
import CustomCamera from '@components/CustomCamera/CustomCamera';
import Footer from '@components/Footer/Footer';
import Camera from '@icons/camera.svg';
import PhoneNumber from './PhoneNumber';
import PrivacyPolicy from './PrivacyPolicy';

type GetCameraImageProps = {
    onSuccess: (data: StepDataType<STEPS.get_camera_image>) => void;
    onBack?: () => void;
    data?: StepDataType<STEPS.get_camera_image>;
    config: StepConfigType<STEPS.get_camera_image>;
    Width?: number;
    Height?: number;
    header?: string;
};

const Contract: FC<GetCameraImageProps> = ({ onSuccess, onBack, Width, Height, header }) => {
    const { currentScreen, switchToScreen } = useRenderScreen('contract');
    const [frame, setFrame] = useState({ width: 0, height: 0 });
    const [capturedData, setCapturedData] = useState<{
        image: string | null,
        height: number,
        width: number
    }>({ image: null, height: 0, width: 0 });
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
                width: Width && Width <= screenHeight ? Width : screenWidth,
                height: Height && Height <= screenHeight ? Height : screenHeight,
            });
        }
    }, [width, height, footerHeight, headerHeight]);

    const renderScreen = () => {
        switch (currentScreen) {
            case 'contract':
                return (
                    <div className={styles.onboardingComponent} >
                        <IconText title='' Img={Pen} imgSize={30} />
                        <div className={styles.table} >
                            <div>
                                <IconText
                                    title=''
                                    Img={ContractSvg} imgSize={150} />
                                <p className={styles.customerIdText} >
                                    The Customer has to Sign a<br />
                                    Contract. Take a photo of the<br />
                                    Signed Contract.
                                </p>
                            </div>
                        </div>
                        <Footer onBack={routeBack} onBackUrl='/' onForward={switchRoute} />
                    </div>
                )
            case 'camera':
                return (
                    <>
                        <Header header={header} />
                        <main style={{ top: '-60px', position: 'relative' }} >
                            <div className={styles.table}>
                                <CustomCamera
                                    width={width ?? 250}
                                    height={(height ?? 300) - footerHeight - headerHeight}
                                    frameWidth={230}
                                    frameHeight={330}
                                    ref={cameraRef}
                                />
                            </div>
                        </main>
                        <Footer onBack={routeBack} onBackUrl={onBack ? undefined : ''} onForward={onSubmit} forwardIcon={Camera} />
                    </>
                )
            case 'contract_verification':
                return (
                    <div className={styles.onboardingComponent} >
                        <IconText title='' Img={Pen} imgSize={30} />
                        <div className="div">
                            <div style={{
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center'
                            }} >
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    height: '330px', width: '230px', borderStyle: 'solid', borderRadius: '5px', borderColor: '#E0A714'
                                }}>
                                    <img src={capturedData.image} alt="Captured Image" width="225" height="310" style={{ borderRadius: '5px' }} />
                                </div>
                            </div>
                            <p style={{ textAlign: 'center' }} >Is the Contract Photo ok?</p>
                        </div>
                        <Footer onBack={routeBack} onBackUrl='/' onForward={switchRoute1} />
                    </div>
                )
            case 'privacy_policy':
                return <PrivacyPolicy />
            case 'previous_route':
                return <PhoneNumber />
        }
    }

    const onSubmit = useCallback(() => {
        const imageSrc = cameraRef.current.captureImage();
        if (imageSrc) {
            const result = { image: imageSrc, height: frame.height, width: frame.width };
            localStorage.setItem('capturedContract', result.image);
            setCapturedData(result);
        }
        switchToScreen('contract_verification');
    }, [cameraRef, frame]);

    const switchRoute = () => {
        switchToScreen('camera');
    };

    const switchRoute1 = () => {
        switchToScreen('privacy_policy');
    };

    const routeBack = () => {
        switchToScreen('previous_route');
    };

    return renderScreen()
}

export default Contract
