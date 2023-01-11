import { FC } from 'react';

import utilsStyles from '@styles/utils.module.scss';
import { VALIDATOR } from 'types/validators';
import styles from './ValidatorCard.module.scss';
import Image from 'next/image';

type ValidatorCardProps = {
	validator: VALIDATOR;
};

const ValidatorCard: FC<ValidatorCardProps> = ({ validator }) => {
	const delegated = !!validator.delegation?.shares;

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
						<span>{(validator.delegation?.balance?.amount || 0) / Math.pow(10, 6)} IXO</span>
					</div>
				</>
			)}
		</>
	);
};

export default ValidatorCard;
