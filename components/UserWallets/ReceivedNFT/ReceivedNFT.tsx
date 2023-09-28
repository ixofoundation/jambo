import React, { useState } from 'react'

import NFTReceived from '@icons/nft_received.svg';
import EarnCarbon from '@icons/earn_carbon.svg';
import IconText from '@components/IconText/IconText';
import styles from '../Wallets.module.scss';
import Footer from '@components/Footer/Footer';
import BuyPallets from '../BuyPallets/BuyPallets';

const ReceivedNFT = () => {
  const [earnCarbon, setEarnCarbon] = useState(true);
  const [showBuyPallets, setShowBuyPallets] = useState(false);
  const handleEarnings = () => {
    setEarnCarbon(!earnCarbon)
  }
  const handleForward = () => {
    setShowBuyPallets(!showBuyPallets);
  };
  return (
    <div>
      {showBuyPallets ? (
        <BuyPallets />
      ) : (
        <div>
          {earnCarbon ? (
            <div>
              <div className={styles.centerContent}>
                <IconText Img={NFTReceived} imgSize={170} title='' />
              </div>
              <p className={styles.centerTxt}>SupaMoto #1,250 received!</p>
              <Footer onForward={handleEarnings} />
            </div>
          ) : (
            <div>
              <div className={styles.centerContent}>
                <IconText Img={EarnCarbon} imgSize={170} title='' />
              </div>
              <p className={styles.centerTxt}>Earn CARBON?</p>
              <p className={styles.centerTxt} style={{ font: '12px', color: '#634545' }}>
                This will authorize SupaMoto to<br />
                issue CARBON credits and send them to you, deducting a monthly fee of 200 CARBON.
              </p>
              <Footer onBackCancel={() => null} onForward={handleForward} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default ReceivedNFT

