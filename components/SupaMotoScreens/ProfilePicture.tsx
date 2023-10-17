import React, { FC, useEffect, useRef, useState } from 'react';
import Camera from '@icons/camera.svg';
import ProfilePic from '@icons/profilepic.svg';
import IconText from '@components/IconText/IconText';
import styles from './SupaMotoScreens.module.scss';
import Footer from '@components/Footer/Footer';
import useWindowDimensions from '@hooks/useWindowDimensions';
import { useRenderScreen } from '@hooks/useRenderScreen';
import { StepConfigType, StepDataType, STEPS } from 'types/steps';

type GetCameraImageProps = {
    onSuccess: (data: StepDataType<STEPS.get_camera_image>) => void;
    onBack?: () => void;
    data?: StepDataType<STEPS.get_camera_image>;
    config: StepConfigType<STEPS.get_camera_image>;
    Width?: number;
    Height?: number;
    header?: string;
};

const ProfilePicture: FC<GetCameraImageProps> = ({ onSuccess, onBack, Width, Height, header }) => {
    const { currentScreen, switchToScreen } = useRenderScreen('');
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
            case 'profile_picture':
                return (
                    <div className={styles.onboardingComponent} >
                        <IconText title='' Img={Camera} imgSize={50} />
                        <div className={styles.table} >
                            <IconText title='Profile Picture' Img={ProfilePic} imgSize={150} />
                        </div>
                        <Footer onBack={routeBack} onBackUrl='/' onForward={switchRoute} />
                    </div>
                )
        }
    }

    const switchRoute = () => {
        switchToScreen('profile_picture');
    };
    const routeBack = () => {
        switchToScreen('previous_route');
    };

    return renderScreen();
}

export default ProfilePicture
