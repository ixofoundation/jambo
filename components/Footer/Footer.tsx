import ButtonRound, { BUTTON_ROUND_COLOR } from '@components/ButtonRound/ButtonRound';
import styles from './Footer.module.scss';
import ArrowLeft from '@icons/arrow_left.svg';
import ArrowRight from '@icons/arrow_right.svg';
import Correct from '@icons/correct.svg';
import AccountImg from '@icons/account.svg';
import Document from '@icons/document.svg';
import { backRoute, replaceRoute } from '@utils/router';
import Link from 'next/link';
import { useContext } from 'react';
import Modal from '@components/Modal/Modal';
import Account from '@components/Account/Account';
import { WalletContext } from '@contexts/wallet';
import useWindowDimensions from '@hooks/windowDimensions';

type FooterProps = {
	onBackUrl?: string;
	onBack?: (() => void) | null;
	backLabel?: string;
	onCorrect?: (() => void) | null;
	correctLabel?: string;
	onForward?: (() => void) | null;
	forwardLabel?: string;
	showAccountButton?: boolean;
	showAboutButton?: boolean;
};

/**
 * If [onForward] or [onCorrect] is undefined then no button, if null then disabled button.
 */
const Footer = ({
	onBack,
	backLabel,
	onBackUrl,
	onCorrect,
	correctLabel,
	onForward,
	forwardLabel,
	showAccountButton,
	showAboutButton,
}: FooterProps) => {
	const { walletModalVisible, showWalletModal, hideWalletModal } = useContext(WalletContext);
	const { width } = useWindowDimensions();

	return (
		<footer className={styles.footer}>
			{showAccountButton && (
				<ButtonRound onClick={showWalletModal}>
					<AccountImg width="20px" height="20px" />
					{!!width && width > 425 && <p className={styles.label}>Account</p>}
				</ButtonRound>
			)}
			{showAboutButton && (
				<Link href="/about">
					<a>
						<ButtonRound>
							<Document width="20px" height="20px" />
							{!!width && width > 425 && <p className={styles.label}>About</p>}
						</ButtonRound>
					</a>
				</Link>
			)}
			{(onBack || onBackUrl || onBackUrl === '') && (
				<ButtonRound onClick={() => (onBack ? onBack() : onBackUrl === '' ? backRoute() : replaceRoute(onBackUrl!))}>
					<ArrowLeft width="20px" height="20px" />
					{!!width && width > 425 && <p className={styles.label}>{backLabel ?? 'Back'}</p>}
				</ButtonRound>
			)}
			{onCorrect !== undefined && (
				<ButtonRound
					color={onCorrect ? BUTTON_ROUND_COLOR.success : BUTTON_ROUND_COLOR.disabled}
					onClick={onCorrect ?? undefined}
				>
					<Correct width="20px" height="20px" />
					{!!width && width > 425 && <p className={styles.label}>{correctLabel ?? 'Next'}</p>}
				</ButtonRound>
			)}
			{onForward !== undefined && (
				<ButtonRound color={onForward ? undefined : BUTTON_ROUND_COLOR.disabled} onClick={onForward ?? undefined}>
					<ArrowRight width="20px" height="20px" />
					{!!width && width > 425 && <p className={styles.label}>{forwardLabel ?? 'Done'}</p>}
				</ButtonRound>
			)}

			{walletModalVisible && (
				<Modal onClose={hideWalletModal}>
					<Account />
				</Modal>
			)}
		</footer>
	);
};

export default Footer;
