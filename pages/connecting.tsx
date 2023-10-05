import React, { FC, useContext, useEffect, useState } from 'react';
import cls from 'classnames';

import utilsStyles from '@styles/utils.module.scss';
import styles from '@styles/stepsPages.module.scss';
import Header from '@components/Header/Header';
import Footer from '@components/Footer/Footer';
import Loader from '@components/Loader/Loader';
import useQueryClient from '@hooks/useQueryClient';
import WalletQR from '@components/UserWallets/WalletQR';
import { WalletContext } from '@contexts/wallet';
import { utils } from '@ixo/impactxclient-sdk';
import { pushNewRoute } from '@utils/router';

type Props = {
  loading?: boolean;
  signedIn?: boolean;
};

const Connecting: FC<Props> = ({ loading = false, signedIn = true }) => {
  const { queryClient } = useQueryClient();
  const { wallet, updateWalletType } = useContext(WalletContext);
  const pubKey = wallet.user?.pubKey;
  const userAddress = wallet.user?.address ?? 'defaultAddress';
  const did = `${pubKey ? utils.did.generateSecpDid(pubKey) : ''}`;
  const [didLedgered, setDidLedgered] = useState(false);
  const handleDIDLedgering = () => {
    setDidLedgered(true);
  };

  useEffect(() => {
    const queryIidDocument = async (did: string) => {
      try {
        const res = await queryClient?.ixo.iid.v1beta1.iidDocument({ id: did });
        return res;
      } catch (error) {
        console.error('queryIidDocument::', error);
        return undefined;
      }
    };
    if (did) {
      queryIidDocument(did)
        .then((result) => {
          console.log('Result:', result);
          if (result) {
            handleDIDLedgering();
          }
        })
        .catch((error) => {
          console.error('Error:', error);
        });
    }
  }, [did, queryClient, userAddress]);

  return (
    <>
      <Header />

      <main className={cls(utilsStyles.main, utilsStyles.columnJustifyCenter, styles.stepContainer)}>
        <div className={utilsStyles.spacer3} />
        {didLedgered ? (
          <>
            <WalletQR />
          </>
        ) : (
          <>
            <Loader />
            <p style={{ color: '#FFFFFF' }} >Connecting...</p>
          </>
        )}
        {/* <Loader />
        <p style={{ color: '#FFFFFF' }} >Connecting...</p> */}
      </main>

      {/* <Footer onBackUrl='/' backLabel='Home' /> */}
    </>
  );
};

export default Connecting;
