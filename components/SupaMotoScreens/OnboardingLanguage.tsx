import React, { useState } from 'react'
import styles from './SupaMotoScreens.module.scss';
import Language from '@icons/language.svg';
import IconText from '@components/IconText/IconText';
import Footer from '@components/Footer/Footer';
import { useRenderScreen } from '@hooks/useRenderScreen';
import Names from './Names';

const OnboardingLanguage = () => {
    const [selected, setSelected] = useState<string | null>(null);
    const { currentScreen, switchToScreen } = useRenderScreen('onboarding_language');

    const handleButtonClick = (label: string) => {
        if (selected === label) {
            setSelected(null);
            localStorage.removeItem('selectedLanguage')
        } else {
            setSelected(label);
            localStorage.setItem('selectedLanguage', label)
        }
    };

    const isButtonSelected = (label: string) => {
        return selected === label;
    }; 

    const renderScreen = () => {
        switch (currentScreen) {
            case 'onboarding_language':
                return (
                    <div className={styles.onboardingComponent} >
                        <IconText title='Onboarding Languages' Img={Language} imgSize={50} />
                        <table className={styles.table} >
                            <tbody>
                                <tr>
                                    <button
                                        className={`${styles.language_button} ${isButtonSelected('Bemba') ? styles.selected : ''}`}
                                        onClick={() => handleButtonClick('Bemba')}
                                    >Bemba</button>
                                    <button
                                        className={`${styles.language_button} ${isButtonSelected('Nyanja') ? styles.selected : ''}`}
                                        onClick={() => handleButtonClick('Nyanja')}
                                    >Nyanja</button>
                                </tr>
                                <tr>
                                    <button
                                        className={`${styles.language_button} ${isButtonSelected('Lozi') ? styles.selected : ''}`}
                                        onClick={() => handleButtonClick('Lozi')}
                                    >Lozi</button>
                                    <button
                                        className={`${styles.language_button} ${isButtonSelected('Tonga') ? styles.selected : ''}`}
                                        onClick={() => handleButtonClick('Tonga')}
                                    >Tonga</button>
                                </tr>
                                <tr>
                                    <button
                                        className={`${styles.language_button} ${isButtonSelected('Kaonde') ? styles.selected : ''}`}
                                        onClick={() => handleButtonClick('Kaonde')}
                                    >Kaonde</button>
                                    <button
                                        className={`${styles.language_button} ${isButtonSelected('English') ? styles.selected : ''}`}
                                        onClick={() => handleButtonClick('English')}
                                    >English</button>
                                </tr>
                            </tbody>
                        </table>
                        <Footer onBack={null} onBackUrl='/' onForward={switchRoute} />
                    </div>
                );
            case 'names':
                return <Names />;
            default:
                return <>Empty</>;
        }
    };

    const switchRoute = () => {
        switchToScreen('names');
    };

    return renderScreen();
}

export default OnboardingLanguage;
