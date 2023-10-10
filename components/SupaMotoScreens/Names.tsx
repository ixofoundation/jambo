import React from 'react'
import styles from './SupaMotoScreens.module.scss';
import IconText from '@components/IconText/IconText';
import Profile from '@icons/profile.svg';
import Dob from './Dob';
import { useRenderScreen } from '@hooks/useRenderScreen';
import Footer from '@components/Footer/Footer';
import OnboardingLanguage from './OnboardingLanguage';

const Names = () => {
    const { currentScreen, switchToScreen } = useRenderScreen('names');
    const renderScreen = () => {
        switch (currentScreen) {
            case 'names':
                return (
                    <div className={styles.onboardingComponent} >
                        <form className={styles.table} >
                            <div>
                                <IconText title='' Img={Profile} imgSize={50} />
                                <div>
                                    <label
                                        className={styles.label}
                                    >First Name</label><br />
                                    <input className={styles.inputs} type='text' placeholder='Name' />
                                </div><br />
                                <div>
                                    <label
                                        className={styles.label}
                                    >Last Name</label><br />
                                    <input className={styles.inputs} type='text' placeholder='Surname' />
                                </div>
                            </div>
                        </form>
                        <Footer onBack={routeBack} onBackUrl='/' onForward={switchRoute} />
                    </div>
                );
            case 'date_of_birth':
                return <Dob />;
            case 'previous_route':
                return <OnboardingLanguage />
            default:
                return <>Empty</>;
        }
    }

    const switchRoute = () => {
        switchToScreen('date_of_birth');
    };
    const routeBack = () => {
        switchToScreen('previous_route');
    };

    return renderScreen()
}

export default Names
