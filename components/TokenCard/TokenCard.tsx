import { HTMLAttributes } from 'react';
import { customQueries } from '@ixo/impactxclient-sdk';
import cls from 'classnames';

import styles from './TokenCard.module.scss';
import ImageWithFallback from '@components/ImageFallback/ImageFallback';
import { formatTokenAmount } from '@utils/currency';
import { CURRENCY } from 'types/wallet';

type TokenCardProps = { token: CURRENCY } & HTMLAttributes<HTMLDivElement>;

const TokenCard = ({ className, token, ...other }: TokenCardProps) => {
	const asset = customQueries.currency.findTokenFromDenom(token.denom);

	return (
		<div className={cls(styles.tokenCard)}>
			<div className={styles.token}>
				<ImageWithFallback
					src={asset?.coinImageUrl ?? ''}
					alt={token.denom}
					fallbackSrc="/images/chain-logos/fallback.png"
					width={20}
					height={20}
				/>
				<p className={styles.label}>{asset?.coinDenom || token.denom}</p>
			</div>
			<p>{formatTokenAmount(Number(token.amount), true, false)}</p>
		</div>
	);
};

export default TokenCard;
