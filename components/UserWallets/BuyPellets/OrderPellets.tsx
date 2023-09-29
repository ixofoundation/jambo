import React, { useState } from 'react'
import styles from '../Wallets.module.scss';
import Pellets from '@icons/pellets_color.svg';
import PelletsImage from './order_pellets.png';
import Tag from '@icons/tag.svg';
import Increment from '@icons/increment.svg';
import Decrement from '@icons/decrement.svg';
import Footer from '@components/Footer/Footer';
import IconText from '@components/IconText/IconText';
import BuySuccess from './BuySuccess.tsx';

const OrderPallets = () => {
  const [pallets, setPallets] = useState(0);
  const [carbonTokens, setCarbonTokens] = useState(0);
  const [buySuccess, setBuySuccess] = useState(false);
  const handleIncrement = () => {
    setPallets(pallets + 10);
    setCarbonTokens(carbonTokens + 1000);
  };
  const handleDecrement = () => {
    if (pallets > 10) {
      setPallets(pallets - 10);
      setCarbonTokens(carbonTokens - 1000);
    }
  };
  const handleBuy = () => {
    setBuySuccess(!buySuccess);
  }
  return (
    <div>
      {buySuccess ? (
        <BuySuccess />
      ) : (
        <div className={styles.adjustTop} >
          <div className={styles.card}>
          </div>
          <div className={styles.orderPalletsCnt}
            style={{ justifyContent: 'space-evenly' }} >
            <button
              onClick={handleDecrement}
              className={styles.orderPalletsBtn} ><Decrement /></button>
            <div className={styles.centerContent} >
              <div className={styles.emptyTab} >
                <div className={styles.dropImg} >
                  <IconText title='' Img={Pellets} imgSize={50} />
                </div>
                {pallets} KG
              </div>
            </div>
            <button
              onClick={handleIncrement}
              className={styles.orderPalletsBtn} ><Increment /></button>
          </div>

          <div className={styles.carbonTknCnt} >
            <div className={styles.carbonTkn} ><Tag /> {carbonTokens} CARBON</div><br />
          </div>
          <Footer join={handleBuy} />
        </div>
      )}
    </div>
  )
}

export default OrderPallets
