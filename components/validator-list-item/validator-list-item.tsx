import { FC, useEffect } from 'react';

import { VALIDATOR } from 'types/validators';
import styles from './validator-list-item.module.scss';
import axios from 'axios';
import Image from 'next/image';

type ValidatorListItemProps = {
	validator: VALIDATOR;
	onClick?: (validator: VALIDATOR) => () => void;
	onAvatarFetched?: (url: string) => void;
};

const fetchValidatorAvatar = async (identity: string, onComplete: (url: string) => void): Promise<void> => {
	try {
		const response = await axios.post('/api/validators/getValidatorAvatar', { identity });
		const { url } = response.data;

		onComplete(url ?? '');
	} catch (error) {
		console.error(error);
	}
};

const ValidatorListItem: FC<ValidatorListItemProps> = ({ validator, onClick, onAvatarFetched }) => {
	const delegated = !!validator?.delegation?.shares;
	useEffect(() => {
		if (validator?.identity && typeof validator.avatarUrl !== 'string' && typeof onAvatarFetched === 'function') {
			fetchValidatorAvatar(validator.identity, onAvatarFetched);
		}
	}, []);

	if (!validator?.address) {
		return null;
	}

	return (
		<div
			key={validator.address}
			className={`${styles.validatorWrapper} ${styles.clickable} ${delegated ? styles.delegatedValidator : ''}`}
			onClick={onClick ? onClick(validator) : () => {}}
		>
			<div className={styles.row}>
				<div className={styles.validatorRank}>{validator.votingRank}</div>
				<div className={styles.validatorAvatar}>
					{!!validator.avatarUrl && (
						<Image src={validator.avatarUrl} alt={`${validator.moniker} avatar`} layout="fill" objectFit="contain" />
					)}
				</div>
				<div className={styles.validatorMoniker}>{validator.moniker} </div>
				<div className={styles.validatorCommission}>{validator.commission}%</div>
			</div>
			{delegated && (
				<div className={styles.row}>
					<div className={styles.validatorText}>My stake:</div>
					<div className={styles.validatorText}>
						{(validator.delegation?.balance?.amount || 0) / Math.pow(10, 6)} IXO
					</div>
				</div>
			)}
		</div>
	);
};

export default ValidatorListItem;
