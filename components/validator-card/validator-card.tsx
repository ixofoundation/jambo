import { FC } from 'react';

import { VALIDATOR } from 'types/validators';
import styles from './validator-card.module.scss';

type ValidatorCardProps = {
	validator: VALIDATOR;
};

const ValidatorCard: FC<ValidatorCardProps> = ({ validator }) => {
	return (
		<div className={styles.validatorCard}>
			<div className={styles.headerRow}>
				<span className={styles.validatorAvatar}></span>
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
	);
};

export default ValidatorCard;
