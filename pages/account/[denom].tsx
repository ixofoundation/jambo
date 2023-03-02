import { useRouter } from 'next/router';
import type { NextPage } from 'next';
import { useContext } from 'react';
import cls from 'classnames';

import utilsStyles from '@styles/utils.module.scss';
import styles from '@styles/accountPage.module.scss';
import { ChainSelectorButton } from '@components/ChainSelector/ChainSelector';
import IconText from '@components/IconText/IconText';
import Footer from '@components/Footer/Footer';
import Header from '@components/Header/Header';
import Head from '@components/Head/Head';
import SadFace from '@icons/sad_face.svg';
import { formatTokenAmount, getDecimalsFromCurrencyToken, getDisplayDenomFromCurrencyToken } from '@utils/currency';
import { extractStakingTokenDenomFromChainInfo } from '@utils/chains';
import { urlDecodeIbcDenom } from '@utils/encoding';
import { groupWalletAssets } from '@utils/wallets';
import { WalletContext } from '@contexts/wallet';
import { ChainContext } from '@contexts/chain';
import config from '@constants/config.json';

// TODO: add dollar values;

const Denom: NextPage = () => {
	const { query } = useRouter();
	const { wallet } = useContext(WalletContext);
	const { chainInfo } = useContext(ChainContext);
	const assets = groupWalletAssets(
		wallet.balances?.balances ?? [],
		wallet.delegations?.delegations ?? [],
		wallet.unbonding?.unbonding ?? [],
		extractStakingTokenDenomFromChainInfo(chainInfo) || '',
	);
	const asset = assets.find((asset) => asset.token.denom === urlDecodeIbcDenom(query.denom as string));

	if (!asset) return <IconText title="Oops" subTitle="Something went wrong" Img={SadFace} imgSize={50} />;

	return (
		<>
			<Head title="Account" description={config.siteDescriptionMeta} />

			<Header allowBack />

			<main className={cls(utilsStyles.main, utilsStyles.columnAlignCenter, styles.denomPage)}>
				<ChainSelectorButton chainImg={chainInfo?.chainSymbolImageUrl} username={wallet?.user?.name} />

				<p>My {getDisplayDenomFromCurrencyToken(asset.token)} Balance</p>
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
			</main>
			<Footer showAccountButton showActionsButton />
		</>
	);
};

export default Denom;
