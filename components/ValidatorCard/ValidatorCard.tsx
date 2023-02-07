import { FC } from 'react';
import Image from 'next/image';

import utilsStyles from '@styles/utils.module.scss';
import styles from './ValidatorCard.module.scss';
import { getDisplayDenomFromDenom } from '@utils/currency';
import { VALIDATOR } from 'types/validators';

type ValidatorCardProps = {
	validator: VALIDATOR;
};

const ValidatorCard: FC<ValidatorCardProps> = ({ validator }) => {
	const delegated = !!validator.delegation?.shares;
	const denom = getDisplayDenomFromDenom(validator.delegation?.balance.denom || '');

	return (
		<>
			<div className={styles.validatorCard}>
				<div className={styles.headerRow}>
					<span className={styles.validatorAvatar}>
						{!!validator.avatarUrl && (
							<Image src={validator.avatarUrl} alt={`${validator.moniker} avatar`} layout="fill" objectFit="contain" />
						)}
					</span>
					<div className={styles.validatorHeader}>{validator.moniker}</div>
				</div>
				<div className={styles.detailRow}>
					<p>Voting Power</p>
					<p>{validator.votingPower}%</p>
				</div>
				<div className={styles.detailRow}>
					<p>Commission</p>
					<p>{validator.commission}%</p>
				</div>
				<div>{validator.description}</div>
			</div>
			{!!delegated && (
				<>
					<div className={utilsStyles.spacer} />
					<div className={styles.stakeCard}>
						<span>My stake:</span>
						<span>
							{Number(validator.delegation?.balance?.amount ?? 0) / Math.pow(10, 6)} {denom}
						</span>
					</div>
				</>
			)}
		</>
	);
};

export default ValidatorCard;
