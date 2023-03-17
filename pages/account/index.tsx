import { useRouter } from 'next/router';
import type { NextPage } from 'next';
import { useContext } from 'react';
import QRCode from 'react-qr-code';
import cls from 'classnames';

import utilsStyles from '@styles/utils.module.scss';
import styles from '@styles/accountPage.module.scss';
import AddressActionButton from '@components/AddressActionButton/AddressActionButton';
import ImageWithFallback from '@components/ImageFallback/ImageFallback';
import BottomSheet from '@components/BottomSheet/BottomSheet';
import TokenList from '@components/TokenList/TokenList';
import { CARD_BG_COLOR } from '@components/Card/Card';
import Wallets from '@components/Wallets/Wallets';
import Header from '@components/Header/Header';
import Footer from '@components/Footer/Footer';
import Loader from '@components/Loader/Loader';
import Head from '@components/Head/Head';
import useWindowDimensions from '@hooks/useWindowDimensions';
import { urlEncodeIbcDenom } from '@utils/encoding';
import { WalletContext } from '@contexts/wallet';
import { ChainContext } from '@contexts/chain';
import useModalState from '@hooks/useModalState';
import config from '@constants/config.json';
import { WALLETS } from '@constants/wallet';

const Account: NextPage = () => {
  const [QRVisible, showQR, hideQR] = useModalState(false);
  const { wallet, updateWalletType, logoutWallet } = useContext(WalletContext);
  const { chainInfo } = useContext(ChainContext);
  const { width } = useWindowDimensions();

  const { push } = useRouter();
  const handleTokenClick = (denom: string) => push(`/account/${urlEncodeIbcDenom(denom)}`);

  return (
    <>
      <Head title='Account' description={config.siteDescriptionMeta} />

      <Header />

      <main className={cls(utilsStyles.main, utilsStyles.columnAlignCenter)}>
        {wallet.user && wallet.walletType ? (
          <>
            <div className={utilsStyles.usernameWrapper} onClick={logoutWallet}>
              {!!wallet.walletType && (
                <ImageWithFallback
                  src={WALLETS[wallet.walletType].img}
                  alt={WALLETS[wallet.walletType].name}
                  height={32}
                  width={32}
                  fallbackSrc='/images/chain-logos/fallback.png'
                />
              )}
              <h3 className={utilsStyles.username}>{wallet.user?.name ?? 'Hi'}</h3>
            </div>
            <div className={utilsStyles.spacer1} />
            <AddressActionButton
              address={wallet.user.address}
              shortAddress
              copyOrQr='qr'
              allowChainChange
              onCopyOrQrClick={showQR}
              walletType={wallet.walletType}
            />
            <div className={utilsStyles.spacer3} />
            <TokenList onTokenClick={handleTokenClick} displayGradient />
            {QRVisible && (
              <BottomSheet onClose={hideQR} bgColor={CARD_BG_COLOR.background}>
                <div className={utilsStyles.columnAlignCenter}>
                  <div className={utilsStyles.usernameWrapper}>
                    <ImageWithFallback
                      fallbackSrc={'/images/chain-logos/fallback.png'}
                      src={chainInfo?.chainSymbolImageUrl ?? ''}
                      width={32}
                      height={32}
                      alt='account'
                    />
                    <h3 className={utilsStyles.username}>{wallet.user?.name ?? 'Hi'}</h3>
                  </div>
                  <div className={utilsStyles.spacer1} />
                  <div className={cls(utilsStyles.columnCenter, styles.qrWrapper)}>
                    <QRCode value={wallet.user.address} size={150} />
                  </div>
                  <div className={utilsStyles.spacer2} />
                  <AddressActionButton
                    shortAddress={wallet.user.address.length >= 42 || (width ?? 0) <= 500}
                    address={wallet.user.address}
                    copyOrQr='copy'
                    onCopyOrQrClick={showQR}
                  />
                  <div className={utilsStyles.spacer1} />
                </div>
              </BottomSheet>
            )}
          </>
        ) : wallet.walletType && !wallet.user ? (
          <>
            <div className={utilsStyles.spacer3} />
            <Loader size={50} />
          </>
        ) : (
          <Wallets onSelected={updateWalletType} />
        )}
      </main>
      <Footer showAccountButton showActionsButton />
    </>
  );
};

export default Account;
