import { HTMLAttributes, useState } from 'react';
import { CopyToClipboard } from 'react-copy-to-clipboard';
import Image from 'next/image';

import styles from './AddressActionButton.module.scss';
import ButtonRound, { BUTTON_ROUND_COLOR, BUTTON_ROUND_SIZE } from '@components/ButtonRound/ButtonRound';
import ColoredIcon, { ICON_COLOR } from '@components/ColoredIcon/ColoredIcon';
import Card, { CARD_SIZE } from '@components/Card/Card';
import QR from '@icons/qr_code.svg';
import Copy from '@icons/copy.svg';
import { shortenAddress } from '@utils/wallets';
import { WALLETS } from '@constants/wallet';
import { WALLET_TYPE } from 'types/wallet';

type AddressActionButtonProps = {
	address: string;
	shortAddress?: boolean;
	onWalletClick?: () => void;
	copyOrQr?: 'copy' | 'qr';
	onCopyOrQrClick?: () => void;
	walletType?: WALLET_TYPE;
} & HTMLAttributes<HTMLDivElement>;

const AddressActionButton = ({
	address,
	shortAddress,
	onWalletClick = () => {},
	copyOrQr,
	onCopyOrQrClick = () => {},
	className,
	walletType,
	...other
}: AddressActionButtonProps) => {
	const [copied, setCopied] = useState(false);
	const addressToDisplay = shortAddress ? shortenAddress(address) : address;

	const onCopy = () => {
		if (copied) return;
		setCopied(true);
		setTimeout(() => {
			setCopied(false);
		}, 1200);
	};

	return (
		<div className={styles.account} {...other}>
			{!!walletType && (
				<ButtonRound onClick={onWalletClick} size={BUTTON_ROUND_SIZE.mediumLarge} color={BUTTON_ROUND_COLOR.lightGrey}>
					<Image src={WALLETS[walletType].img} alt={WALLETS[walletType].name} height={24} width={24} />
				</ButtonRound>
			)}
			<div className={styles.column}>
				<CopyToClipboard text={address} onCopy={onCopy}>
					<Card className={styles.card} title={address} size={CARD_SIZE.mediumLarge} rounded>
						{addressToDisplay}
					</Card>
				</CopyToClipboard>
				{copied ? <p className={styles.copied}>copied</p> : null}
			</div>
			{copyOrQr === 'copy' ? (
				<CopyToClipboard text={address} onCopy={onCopy}>
					<ButtonRound
						onClick={onCopyOrQrClick}
						size={BUTTON_ROUND_SIZE.mediumLarge}
						color={BUTTON_ROUND_COLOR.lightGrey}
					>
						<ColoredIcon icon={Copy} color={ICON_COLOR.primary} size={24} />
					</ButtonRound>
				</CopyToClipboard>
			) : copyOrQr === 'qr' ? (
				<ButtonRound
					onClick={onCopyOrQrClick}
					size={BUTTON_ROUND_SIZE.mediumLarge}
					color={BUTTON_ROUND_COLOR.lightGrey}
				>
					<ColoredIcon icon={QR} color={ICON_COLOR.primary} size={24} />
				</ButtonRound>
			) : null}
		</div>
	);
};

export default AddressActionButton;
