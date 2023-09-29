import React, { useState } from 'react'
import cls from 'classnames';

import Wallet from '@icons/wallet_color.svg';
import Pellets from '@icons/pellets.svg';
import Crops from '@icons/crops.svg';
import Finance from '@icons/finance.svg';
import Insure from '@icons/insure.svg';
import styles from '../Wallets.module.scss';
import style$ from '@styles/stepsPages.module.scss';
import utilsStyles from '@styles/utils.module.scss';
import IconText from '@components/IconText/IconText';
import OrderPallets from '@components/UserWallets/BuyPallets/OrderPallets'

const BuyPallets = () => {
    const [showOrderPallets, setShowOrderPallets] = useState(false);
    const Frames = [
        <div className={styles.frame}>
            <IconText
                className={styles.frameFont}
                title={`PELLETS`}
                Img={Pellets}
                imgSize={70}
                onClick={() => {
                    setShowOrderPallets(!showOrderPallets);
                }}
            />
        </div>,
        <div className={styles.frame}>
            <IconText
                className={styles.frameFont}
                title='SEND'
                Img={Crops}
                imgSize={70}
            />
        </div>,
        <div className={styles.frame}>
            <IconText
                className={styles.frameFont}
                title='SAVE'
                Img={Finance}
                imgSize={70}
            />
        </div>,
        <div className={styles.frame}>
            <IconText
                className={styles.frameFont}
                title='INSURE'
                Img={Insure}
                imgSize={70}
            />
        </div>
    ]
    return (
        <div>
            {showOrderPallets ? (
                <OrderPallets />
            ) : (
                <main className={cls(utilsStyles.main, utilsStyles.columnJustifyCenter, style$.stepContainer)} >
                    <div className={styles.cntrMain} >
                        <div className={styles.balance} >
                            <span className={styles.spaceArd} >
                                <Wallet />
                            </span>
                            <p style={{
                                fontSize: '20px',
                                color: 'white',
                            }} >1'200 CARBON</p>
                        </div>
                        <div className={styles.centerContent}>
                            <div className={styles.gridContainer} >
                                {
                                    Frames?.map((data, i) => (
                                        <div className={styles.gridItem} key={i}>
                                            {data}
                                        </div>
                                    ))
                                }
                            </div>
                        </div>
                    </div>
                </main>
            )}
        </div>
    )
}

export default BuyPallets;

