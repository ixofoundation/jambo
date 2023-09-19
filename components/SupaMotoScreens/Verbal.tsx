import React, { useState } from 'react'
import VerbalSvg from '@icons/verbal.svg'
import IconText from '@components/IconText/IconText';
import styles from './SupaMotoScreens.module.scss';

const Verbal = () => {
    const [selected, setSelected] = useState<string | null>(null);
    const handleButtonClick = (label: string) => {
        if (selected === label) {
            setSelected(null);
        } else {
            setSelected(label);
        }
    };
    const isButtonSelected = (label: string) => {
        return selected === label;
    };
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
        </div>
    )
}

export default Verbal
