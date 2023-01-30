import { HTMLAttributes } from 'react';
import { DecCoin } from '@ixo/impactxclient-sdk/types/codegen/cosmos/base/v1beta1/coin';
import cls from 'classnames';

import styles from './TokenCard.module.scss';
import ImageWithFallback from '@components/ImageFallback/ImageFallback';
import { findTokenFromDenom } from '@constants/chains';
import { formatTokenAmount } from '@utils/currency';

type TokenCardProps = { token: DecCoin } & HTMLAttributes<HTMLDivElement>;

const TokenCard = ({ className, token, ...other }: TokenCardProps) => {
	const asset = findTokenFromDenom(token.denom);

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
