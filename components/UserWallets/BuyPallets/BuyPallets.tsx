import React from 'react'
import Wallet from '@icons/wallet.svg';
import Pellets from '@icons/pellets.svg';
import styles from '../Wallets.module.scss';
import IconText from '@components/IconText/IconText';

const BuyPallets = () => {
    return (
        <div>
            <div style={{
                display: 'flex',
                justifyContent: 'center',
                backgroundColor: '#4F3535',
                borderRadius: '16px',
                alignItems: 'center',
                height: '139px',
                width: '320px',
            }} >
                <Wallet /><p className={styles.centerTxt} >1'200 CARBON</p>
            </div>
            <div>
                <div
                    style={{
                        height: '120px',
                        width: '120px',
                        borderRadius: '16px',
                        backgroundColor: '#E0A714',
                    }}
                >
                    <IconText
                        title='PELLETS'
                        Img={Pellets}
                        imgSize={70} />
                </div>
            </div>
        </div>
    )
}

export default BuyPallets
