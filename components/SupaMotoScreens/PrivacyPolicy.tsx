import React, { FC, FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import Pen from '@icons/pen.svg';
import ContractSvg from '@icons/contract.svg';
import styles from './SupaMotoScreens.module.scss';
import IconText from '@components/IconText/IconText';
import { useRenderScreen } from '@hooks/useRenderScreen';
import useWindowDimensions from '@hooks/useWindowDimensions';
import { StepConfigType, StepDataType, STEPS } from 'types/steps';
import CustomCamera from '@components/CustomCamera/CustomCamera';
import Footer from '@components/Footer/Footer';
import Header from '@components/Header/Header';
import Camera from '@icons/camera.svg';
import Success from '@icons/successcheck.svg';
import Contract from './Contract';
import VerifyData from './VerifyData'

type GetCameraImageProps = {
    onSuccess?: (data?: StepDataType<STEPS.request_onboarding>) => void;
    onBack?: () => void;
    data?: StepDataType<STEPS.request_onboarding>;
    config: StepConfigType<STEPS.request_onboarding>;
    Width?: number;
    Height?: number;
    header?: string;
};

const PrivacyPolicy: FC<GetCameraImageProps> = ({ onSuccess, onBack, Width, Height, header, data }) => {
    const { currentScreen, switchToScreen } = useRenderScreen('privacy_policy');
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
            case 'privacy_policy':
                return (
                    <div className={styles.onboardingComponent} >
                        <IconText title='' Img={Pen} imgSize={30} />
                        <div>
                            <IconText
                                title=''
                                Img={ContractSvg} imgSize={150} />
                            <p className={styles.customerIdText} >
                                Now the Customer has to Sign a<br />
                                Privacy Policy waiver.<br />
                                Take a photo of the signed<br />
                                document.
                            </p>
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
            case 'policy_verification':
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
                            <p style={{ textAlign: 'center' }} >Is the Waiver Photo ok?</p>
                        </div>
                        <Footer onBack={routeBack} onBackUrl='/' onForward={switchRoute1} />
                    </div>
                )
            case 'data_verification':
                return (
                    <>
                        <VerifyData />
                        <Footer onBack={routeBack} onBackUrl='/' onCorrect={() => switchRoute2()} />
                    </>
                )
            case 'success':
                return (
                    <>
                        <IconText Img={Success} imgSize={150} title={'Customer information submitted'} />
                    </>
                )
            case 'previous_route':
                return <Contract />
            default:
                return null;
        }
    }

    const onSubmit = useCallback(() => {
        const imageSrc = cameraRef.current.captureImage();
        if (imageSrc) {
            const result = { image: imageSrc, height: frame.height, width: frame.width };
            localStorage.setItem('capturedContract', result.image);
            setCapturedData(result);
        }
        switchToScreen('policy_verification');
    }, [cameraRef, frame]);

    const switchRoute = () => {
        switchToScreen('camera');
    };

    const switchRoute1 = () => {
        switchToScreen('data_verification');
    }

    const switchRoute2 = () => {
        switchToScreen('success')
    }

    const routeBack = () => {
        switchToScreen('previous_route');
    };

    return renderScreen();
}

export default PrivacyPolicy

