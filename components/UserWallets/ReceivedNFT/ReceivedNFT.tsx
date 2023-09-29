import React, { useState } from 'react'

import NFTReceived from '@icons/nft_received.svg';
import EarnCarbon from '@icons/earn_carbon.svg';
import IconText from '@components/IconText/IconText';
import styles from '../Wallets.module.scss';
import Footer from '@components/Footer/Footer';
import BuyPellets from '../BuyPellets/BuyPellets';

const ReceivedNFT = () => {
  const [earnCarbon, setEarnCarbon] = useState(true);
  const [showBuyPellets, setShowBuyPellets] = useState(false);
  const handleEarnings = () => {
    setEarnCarbon(!earnCarbon)
  }
  const handleForward = () => {
    setShowBuyPellets(!showBuyPellets);
  };
  return (
    <div>
      {showBuyPellets ? (
        <BuyPellets />
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

