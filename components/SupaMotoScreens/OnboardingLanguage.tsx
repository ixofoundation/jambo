import React from 'react'
import styles from './SupaMotoScreens.module.scss'

import Language from '@icons/language.svg';
import IconText from '@components/IconText/IconText';

const OnboardingLanguage = () => {
    return (
        <div>
            <IconText title='Onboarding Languages' Img={Language} imgSize={50} />
            <table>
                <tr>
                    <button
                        className={styles.language_button}
                    >Bemba</button>
                    <button
                        className={styles.language_button}
                    >Nyanja</button>
                </tr>
                <tr>
                    <button
                        className={styles.language_button}
                    >Lozi</button>
                    <button
                        className={styles.language_button}
                    >Tonga</button>
                </tr>
                <tr>
                    <button
                        className={styles.language_button}
                    >Kaonde</button>
                    <button
                        className={styles.language_button}
                    >English</button>
                </tr>
            </table>
        </div>
    )
}

export default OnboardingLanguage
