import ButtonRound, { BUTTON_ROUND_COLOR } from '@components/button-round/button-round';
import styles from './footer.module.scss';
import ArrowLeft from '@icons/arrow_left.svg';
import ArrowRight from '@icons/arrow_right.svg';
import Correct from '@icons/correct.svg';
import AccountImg from '@icons/account.svg';
import Document from '@icons/document.svg';
import { backRoute, replaceRoute } from '@utils/router';
import Link from 'next/link';
import { useState } from 'react';
import Modal from '@components/modal/modal';
import Account from '@components/account/account';

type FooterProps = {
	onBackUrl?: string;
	onBack?: (() => void) | null;
	onCorrect?: (() => void) | null;
	onForward?: (() => void) | null;
	showAccountButton?: boolean;
	showAboutButton?: boolean;
};

/**
 * If [onForward] or [onCorrect] is undefined then no button, if null then disabled button.
 */
const Footer = ({ onBack, onBackUrl, onCorrect, onForward, showAccountButton, showAboutButton }: FooterProps) => {
	const [showModal, setShowModal] = useState(false);

	return (
		<footer className={styles.footer}>
			{showAccountButton && (
				<ButtonRound onClick={() => setShowModal(true)}>
					<AccountImg width="20px" height="20px" />
				</ButtonRound>
			)}
			{showAboutButton && (
				<Link href="/about">
					<a>
						<ButtonRound>
							<Document width="20px" height="20px" />
						</ButtonRound>
					</a>
				</Link>
			)}
			{(onBack || onBackUrl || onBackUrl === '') && (
				<ButtonRound onClick={() => (onBack ? onBack() : onBackUrl === '' ? backRoute() : replaceRoute(onBackUrl!))}>
					<ArrowLeft width="20px" height="20px" />
				</ButtonRound>
			)}
			{onCorrect !== undefined && (
				<ButtonRound color={onCorrect ? BUTTON_ROUND_COLOR.success : BUTTON_ROUND_COLOR.disabled} onClick={onCorrect ?? undefined}>
					<Correct width="20px" height="20px" />
				</ButtonRound>
			)}
			{onForward !== undefined && (
				<ButtonRound color={onForward ? undefined : BUTTON_ROUND_COLOR.disabled} onClick={onForward ?? undefined}>
					<ArrowRight width="20px" height="20px" />
				</ButtonRound>
			)}
			{showModal && (
				<Modal onClose={() => setShowModal(false)}>
					<Account />
				</Modal>
			)}
		</footer>
	);
};

export default Footer;
