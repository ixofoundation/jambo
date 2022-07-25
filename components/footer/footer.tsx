import ButtonRound, { BUTTON_ROUND_COLOR } from '@components/button-round/button-round';
import styles from './footer.module.scss';
import ArrowLeft from '@icons/arrow_left.svg';
import ArrowRight from '@icons/arrow_right.svg';
import Correct from '@icons/correct.svg';
import { replaceRoute } from '@utils/router';

type FooterProps = {
	onBackUrl?: string;
	onCorrect?: (() => void) | null;
	onForward?: (() => void) | null;
};

/**
 * If [onForward] or [onCorrect] is undefined then no button, if null then disabled button.
 */
const Footer = ({ onBackUrl, onCorrect, onForward }: FooterProps) => {
	return (
		<footer className={styles.footer}>
			{onBackUrl && (
				<ButtonRound onClick={() => replaceRoute(onBackUrl)}>
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
		</footer>
	);
};

export default Footer;
