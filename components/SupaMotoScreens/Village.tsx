import React from 'react'
import styles from './SupaMotoScreens.module.scss';
import VillageSvg from '@icons/village.svg';
import IconText from '@components/IconText/IconText';
import ProfilePicture from './ProfilePicture';
import Footer from '@components/Footer/Footer';
import Gender from './Gender';
import { useRenderScreen } from '@hooks/useRenderScreen';

const Village = () => {
    const { currentScreen, switchToScreen } = useRenderScreen('village');
    
    const renderScreen = () => {
        switch (currentScreen) {
            case 'village':
                return (
                    <div className={styles.onboardingComponent} >
                        <IconText title='Village' Img={VillageSvg} imgSize={70} />
                        <div className={styles.table} >
                            <input className={styles.inputs} type='text' />
                        </div>
                        <Footer onBack={routeBack} onBackUrl='/' onForward={switchRoute} />
                    </div>
                )
            case 'profile_picture':
                return <ProfilePicture />
            case 'previous_route':
                return <Gender />
            default:
                return <>Empty</>;
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

export default Village
