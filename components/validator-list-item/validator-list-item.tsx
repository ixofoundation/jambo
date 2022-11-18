import { ChangeEvent, FC, FormEvent, lazy, Suspense, useState, useEffect, useContext } from 'react';
import cls from 'classnames';

import { VALIDATOR } from 'types/validators';
import styles from './validator-list-item.module.scss';
import { validatorAvatarUrl } from 'helpers/validatorAvatarUrl';

type ValidatorListItemProps = {
	validator: VALIDATOR;
	onClick: (validator: VALIDATOR) => () => void;
	onAvatarFetched: (avatarUrl: string) => void;
};

const fetchValidatorAvatar = async (identity: string, onComplete: (avatarUrl: string) => void): Promise<void> => {
	try {
		const avatarUrl = await validatorAvatarUrl(identity);
		onComplete(avatarUrl);
	} catch (error) {
		// console.error(error);
	}
};

const ValidatorListItem: FC<ValidatorListItemProps> = ({ validator, onClick, onAvatarFetched }) => {
	useEffect(() => {
		if (validator.identity) {
			fetchValidatorAvatar(validator.identity, onAvatarFetched);
		}
	}, []);

	return (
		<div
			key={validator.address}
			className={cls(styles.validatorWrapper, styles.clickable)}
			onClick={onClick(validator)}
		>
			<span className={styles.validatorRank}>{validator.votingRank}</span>
			<span className={styles.validatorAvatar}></span>
			<span className={styles.validatorMoniker}>{validator.moniker} </span>
			<span className={styles.validatorCommission}>{validator.commission}%</span>
		</div>
	);
};

export default ValidatorListItem;
