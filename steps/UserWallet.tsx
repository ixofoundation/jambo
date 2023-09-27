import React, { useContext, useEffect, useState } from 'react';
import cls from 'classnames';

import utilsStyles from '@styles/utils.module.scss';
import styles from '@styles/stepsPages.module.scss';
import Header from '@components/Header/Header';
import QueryCheck from '@components/UserWallets/QueryCheck';
import useQueryClient from '@hooks/useQueryClient';
import { WalletContext } from '@contexts/wallet';
import { utils } from '@ixo/impactxclient-sdk';
import WalletQR from '@components/UserWallets/WalletQR';
import ReceivedNFT from '@components/UserWallets/ReceivedNFT/ReceivedNFT';
import OrderPallets from '@components/UserWallets/BuyPallets/OrderPallets';

const UserWallet = () => {
  const [hasLedgeredDid, setHasLedgeredDid] = useState(false);
  const { queryClient } = useQueryClient();
  const { wallet, updateWalletType } = useContext(WalletContext);
  const pubKey = wallet.user?.pubKey;
  const did = `${pubKey ? utils.did.generateSecpDid(pubKey) : ''}`;

  useEffect(() => {
    const queryIidDocument = async () => {
      try {
        const res = await queryClient?.ixo.iid.v1beta1.iidDocument({ id: did });
        if (res) {
          // If an IID document is found, set hasLedgeredDid to true
          setHasLedgeredDid(true);
        }
      } catch (error) {
        console.error('queryIidDocument::', error);
      }
    };

    if (did) {
      queryIidDocument(); // Call the query function
    }
  }, [did, queryClient]);

  return (
    <>
      <Header />
      <main className={cls(utilsStyles.main, utilsStyles.columnJustifyCenter, styles.stepContainer)}>
        {hasLedgeredDid ? (
          <WalletQR />
        ) : (
          <QueryCheck />
        )}
        {/* <OrderPallets /> */}
        {/* <ReceivedNFT /> */}
      </main>
    </>
  );
};

export default UserWallet;
