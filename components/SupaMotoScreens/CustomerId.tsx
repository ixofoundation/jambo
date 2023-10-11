import React from 'react'
import Customer from '@icons/customer.svg';
import styles from './SupaMotoScreens.module.scss';
import IconText from '@components/IconText/IconText';
import { useRenderScreen } from '@hooks/useRenderScreen';
import StoveUsage from './StoveUsage';
import GetCameraImage from './GetCameraImage';
import Footer from '@components/Footer/Footer';

const CustomerId = () => {
    const { currentScreen, switchToScreen } = useRenderScreen('customer_identification');
    const renderScreen = () => {
        switch (currentScreen) {
            case 'customer_identification':
                return (
                    <div className={styles.onboardingComponent} >
                        <IconText title='' Img={Customer} imgSize={30} />
                        <div>
                            <IconText title='Take a photo of the Customer ID front side'
                                Img={Customer} imgSize={150} />
                        </div>
                        <Footer onBack={routeBack} onBackUrl='/' onForward={switchRoute} />
                    </div>
                )
            case 'camera':
                return <GetCameraImage />;
            case 'previous_route':
                return <StoveUsage />
            default:
                return <>Empty</>;
        }
    }

    const switchRoute = () => {
        switchToScreen('camera');
    };
    const routeBack = () => {
        switchToScreen('previous_route');
    };

    return renderScreen()
}

export default CustomerId;
