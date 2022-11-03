import { HTMLAttributes } from 'react';
import cls from 'classnames';

import styles from './token-card.module.scss';
import { findTokenFromDenom } from '@constants/chains';
import { formatTokenAmount } from '@utils/currency';
import ImageWithFallback from '@components/image-fallback/image-fallback';
import { Currency } from 'types/wallet';

type TokenCardProps = { token: Currency } & HTMLAttributes<HTMLDivElement>;

const TokenCard = ({ className, token, ...other }: TokenCardProps) => {
	const asset = findTokenFromDenom(token.denom);

	return (
		<div className={cls(styles.tokenCard)}>
			<div className={styles.token}>
				<ImageWithFallback src={asset?.coinImageUrl ?? ''} alt={token.denom} fallbackSrc="/images/chain-logos/fallback.png" width={20} height={20} />
				<p className={styles.label}>{asset?.coinDenom || token.denom}</p>
			</div>
			<p>{formatTokenAmount(token.amount!)}</p>
		</div>
	);
};

export default TokenCard;
