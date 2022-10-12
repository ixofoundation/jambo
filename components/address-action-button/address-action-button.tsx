import { HTMLAttributes } from 'react';

import styles from './address-action-button.module.scss';
import Card from '@components/card/card';
import ButtonRound, { BUTTON_ROUND_SIZE } from '@components/button-round/button-round';

type AddressActionButtonProps = {
	address: string;
	ButtonLogo: any;
	buttonOnClick: () => void;
} & HTMLAttributes<HTMLDivElement>;

const AddressActionButton = ({ address, ButtonLogo, buttonOnClick, className, ...other }: AddressActionButtonProps) => {
	return (
		<div className={styles.account} {...other}>
			<div>
				<Card className={styles.card}>{address}</Card>
			</div>
			<ButtonRound className={styles.button} onClick={buttonOnClick} size={BUTTON_ROUND_SIZE.mediumLarge}>
				<ButtonLogo width={24} height={24} />
			</ButtonRound>
		</div>
	);
};

export default AddressActionButton;
