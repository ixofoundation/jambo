import React, { useState } from 'react'
import SMS from './SMS';
import VerbalSvg from '@icons/verbal.svg';
import IconText from '@components/IconText/IconText';
import styles from './SupaMotoScreens.module.scss';
import { useRenderScreen } from '@hooks/useRenderScreen';
import Footer from '@components/Footer/Footer';
import Coordinates from './Coordinates';

const Verbal = () => {
    const [selected, setSelected] = useState<string | null>(null);
    const { currentScreen, switchToScreen } = useRenderScreen('verbal');
    
    const handleButtonClick = (label: string) => {
        if (selected === label) {
            setSelected(null);
            localStorage.removeItem('selectedVerbalLanguage')
        } else {
            setSelected(label);
            localStorage.setItem('selectedVerbalLanguage', label)
        }
    };
    
    const isButtonSelected = (label: string) => {
        return selected === label;
    };

    const renderScreen = () => {
        switch (currentScreen) {
            case 'verbal':
                return (
                    <div className={styles.onboardingComponent} >
                        <IconText title='Verbal Language' Img={VerbalSvg} imgSize={30} />
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
            case 'sms':
                return <SMS />
            case 'previous_route':
                return <Coordinates />
        }
    }

    const switchRoute = () => {
        switchToScreen('sms');
    };

    const routeBack = () => {
        switchToScreen('previous_route');
    };

    return renderScreen()
}

export default Verbal
