import React from 'react'
import VerbalSvg from '@icons/verbal.svg'
import IconText from '@components/IconText/IconText';
import styles from './SupaMotoScreens.module.scss';

const Verbal = () => {
    return (
        <div>
            <IconText title='Verbal Language' Img={VerbalSvg} imgSize={30} />
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

export default Verbal
