import { useRouter } from 'next/router';
import type { NextPage } from 'next';
import { useContext } from 'react';
import cls from 'classnames';

import utilsStyles from '@styles/utils.module.scss';
import styles from '@styles/accountPage.module.scss';
import ImageWithFallback from '@components/ImageFallback/ImageFallback';
import IconText from '@components/IconText/IconText';
import Footer from '@components/Footer/Footer';
import Header from '@components/Header/Header';
import Head from '@components/Head/Head';
import SadFace from '@icons/sad_face.svg';
import { formatTokenAmount, getDecimalsFromCurrencyToken, getDisplayDenomFromCurrencyToken } from '@utils/currency';
import { urlDecodeIbcDenom } from '@utils/encoding';
import { groupWalletAssets } from '@utils/wallets';
import { WalletContext } from '@contexts/wallet';
import { ChainContext } from '@contexts/chain';
import config from '@constants/config.json';

// TODO: add dollar values;

const Denom: NextPage = () => {
  const { query, replace } = useRouter();
  const { wallet } = useContext(WalletContext);
  const { chainInfo } = useContext(ChainContext);
  const assets = groupWalletAssets(
    wallet.balances?.data ?? [],
    wallet.delegations?.data ?? [],
    wallet.unbondingDelegations?.data ?? [],
    wallet.tokenBalances?.data,
  );
  const asset = assets.find((asset) => asset.token.denom === urlDecodeIbcDenom(query.denom as string));

  if (!asset) return <IconText title='Oops' subTitle='Something went wrong' Img={SadFace} imgSize={50} />;

  const backToAccount = () => replace('/account');

  return (
    <>
      <Head title='Account' description={config.siteDescriptionMeta} />

      <Header />

      <main className={cls(utilsStyles.main, utilsStyles.columnAlignCenter, styles.denomPage)}>
        <div className={utilsStyles.usernameWrapper} onClick={backToAccount}>
          <ImageWithFallback
            fallbackSrc={'/images/chain-logos/fallback.png'}
            src={chainInfo?.chainSymbolImageUrl ?? ''}
            width={32}
            height={32}
            alt='account'
          />
          <h3 className={utilsStyles.username}>{wallet.user?.name ?? 'Hi'}</h3>
        </div>

        <p>
          My {getDisplayDenomFromCurrencyToken(asset.token)} Balance{asset.token.ibc && ' (ibc)'}
        </p>
        <p className={styles.totalBalance}>
          {formatTokenAmount(
            asset.available + asset.staked + asset.undelegating,
            getDecimalsFromCurrencyToken(asset.token),
            false,
          )}
        </p>

        <div className={styles.assetRow}>
          <div className={styles.assetLabel}>
            <div className={cls(styles.dot, styles.primaryDot)}>available</div>
          </div>
          <p>
            {formatTokenAmount(asset.available, getDecimalsFromCurrencyToken(asset.token), false)}{' '}
            {getDisplayDenomFromCurrencyToken(asset.token)}
          </p>
        </div>
        {!asset.token.ibc && (
          <>
            <div className={styles.assetRow}>
              <div className={styles.assetLabel}>
                <div className={cls(styles.dot, styles.secondaryDot)}>staked</div>
              </div>
              <p>
                {formatTokenAmount(asset.staked, getDecimalsFromCurrencyToken(asset.token), false)}{' '}
                {getDisplayDenomFromCurrencyToken(asset.token)}
              </p>
            </div>
            <div className={styles.assetRow}>
              <div className={styles.assetLabel}>
                <div className={cls(styles.dot, styles.tertiaryDot)}>undelegating</div>
              </div>
              <p>
                {formatTokenAmount(asset.undelegating, getDecimalsFromCurrencyToken(asset.token), false)}{' '}
                {getDisplayDenomFromCurrencyToken(asset.token)}
              </p>
            </div>
          </>
        )}
      </main>
      <Footer showAccountButton showActionsButton />
    </>
  );
};

export default Denom;
