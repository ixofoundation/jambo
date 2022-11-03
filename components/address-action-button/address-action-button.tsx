import { HTMLAttributes, useState } from 'react';
import { CopyToClipboard } from 'react-copy-to-clipboard';

import styles from './address-action-button.module.scss';
import Card from '@components/card/card';
import ButtonRound, { BUTTON_ROUND_SIZE } from '@components/button-round/button-round';

type AddressActionButtonProps = {
	address: string;
	ButtonLogo: any;
	wrapButtonWithCopy?: boolean;
	buttonOnClick?: () => void;
} & HTMLAttributes<HTMLDivElement>;

const AddressActionButton = ({ address, ButtonLogo, buttonOnClick, wrapButtonWithCopy, className, ...other }: AddressActionButtonProps) => {
	const [copied, setCopied] = useState(false);

	const onCopy = () => {
		if (copied) return;
		setCopied(true);
		setTimeout(() => {
			setCopied(false);
		}, 1200);
	};

	return (
		<>
			<div className={styles.account} {...other}>
				<div className={styles.column}>
					<CopyToClipboard text={address} onCopy={() => onCopy()}>
						<Card className={styles.card}>{address}</Card>
					</CopyToClipboard>
					{copied ? <p className={styles.copied}>copied</p> : <div />}
				</div>
				{wrapButtonWithCopy ? (
					<CopyToClipboard text={address} onCopy={() => onCopy()}>
						<ButtonRound className={styles.button} onClick={buttonOnClick} size={BUTTON_ROUND_SIZE.mediumLarge}>
							<ButtonLogo width={24} height={24} />
						</ButtonRound>
					</CopyToClipboard>
				) : (
					<ButtonRound className={styles.button} onClick={buttonOnClick} size={BUTTON_ROUND_SIZE.mediumLarge}>
						<ButtonLogo width={24} height={24} />
					</ButtonRound>
				)}
			</div>
		</>
	);
};

export default AddressActionButton;
