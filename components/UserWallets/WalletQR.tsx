import React, { useContext } from 'react'
import styles from './Wallets.module.scss';
import QRCode from 'react-qr-code';
import { utils } from '@ixo/impactxclient-sdk';
import { WalletContext } from '@contexts/wallet';
import Footer from '@components/Footer/Footer';

const WalletQR = () => {
    const { wallet } = useContext(WalletContext);
    const pubKey = wallet.user?.pubKey;
    const did = `${pubKey ? utils.did.generateSecpDid(pubKey) : ''}`;
    return (
        <div>
            <header className={styles.centerTxt} >Successfully Joined!</header>
            <div className="div">
                <p className={styles.centerTxt} >Please show this QR code to<br /> a SupaMoto agent</p>
                <div className={styles.qrCode} >
                    <QRCode
                        value={did}
                        bgColor='#FFFFFF'
                        size={150}
                    />
                </div>
            </div>
            <Footer />
        </div>
    )
}

export default WalletQR
