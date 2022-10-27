import { HTMLAttributes } from 'react';
import cls from 'classnames';

import styles from './token-card.module.scss';
import { Currency } from 'types/user';
import { ASSETS } from '@constants/chains';
import { formatTokenAmount, formatterToken, formatterUSD } from '@utils/currency';
import ImageWithFallback from '@components/image-fallback/image-fallback';

type TokenCardProps = { token: Currency } & HTMLAttributes<HTMLDivElement>;

const TokenCard = ({ className, token, ...other }: TokenCardProps) => {
	const asset = ASSETS.assets.find((asset: any) => asset.base === token.denom);

	return asset ? (
		<div className={cls(styles.tokenCard)}>
			<div className={styles.token}>
				<ImageWithFallback src={Object.values(asset.logo_URIs)[0]} alt={token.denom} fallbackSrc="/images/chain-logos/fallback.png" width={20} height={20} />
				<p className={styles.label}>{asset.symbol}</p>
			</div>
			<p>{formatTokenAmount(token.amount!)}</p>
		</div>
	) : (
		<div />
	);
};

export default TokenCard;
