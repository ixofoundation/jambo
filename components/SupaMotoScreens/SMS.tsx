import React, { useState } from 'react'
import SMSSvg from '@icons/smslang.svg'
import IconText from '@components/IconText/IconText';
import styles from './SupaMotoScreens.module.scss';
import { useRenderScreen } from '@hooks/useRenderScreen';
import PhoneNumber from './PhoneNumber';
import Verbal from './Verbal';
import Footer from '@components/Footer/Footer';

const SMS = () => {
    const [selected, setSelected] = useState<string | null>(null);
    const { currentScreen, switchToScreen } = useRenderScreen('sms');

    const handleButtonClick = (label: string) => {
        if (selected === label) {
            setSelected(null);
            localStorage.removeItem('selectedSmsLanguage')
        } else {
            setSelected(label);
            localStorage.setItem('selectedSmsLanguage', label)
        }
    };
    
    const isButtonSelected = (label: string) => {
        return selected === label;
    };

    const renderScreen = () => {
        switch (currentScreen) {
            case 'sms':
                return (
                    <div className={styles.onboardingComponent} >
                        <IconText title='SMS Language' Img={SMSSvg} imgSize={30} />
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
                        <Footer onBack={routeBack} onBackUrl='/' onForward={switchRoute} />
                    </div>
                )
            case 'phone_number':
                return <PhoneNumber />
            case 'previous_route':
                return <Verbal />
        }
    }

    const switchRoute = () => {
        switchToScreen('phone_number');
    };

    const routeBack = () => {
        switchToScreen('previous_route');
    };

    return renderScreen()
}

export default SMS
