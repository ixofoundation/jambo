import React from 'react'
import Buy from '@icons/buy.svg';
import IconText from '@components/IconText/IconText';
import styles from '../Wallets.module.scss';
import Footer from '@components/Footer/Footer';

const BuySuccess = () => {
    return (
        <div className={styles.adjustTop} >
            <IconText title='' Img={Buy} imgSize={300} />
            <div className={styles.adjustTop} >
                <header className={styles.centerTxt} >
                    10 kg purchased<br />
                    for 1,000 CARBON<br />
                    produced by clean cooking
                </header>
            </div>
            <p
                className={styles.centerTxt}
                style={{ color: '#6b6b6b' }}
            >Will be delivered shortly</p>
            <Footer onBackHome={() => null} onBackUrl='/'  />
        </div>
    )
}

export default BuySuccess
