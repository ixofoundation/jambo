import { ButtonHTMLAttributes } from 'react';
import cls from 'classnames';

import styles from './button-round.module.scss';
import Correct from '@icons/correct.svg';

export enum BUTTON_ROUND_COLOR {
	accent = '',
	success = 'withSuccessBgColor',
	disabled = 'withDisabledBgColor',
	grey = 'withGreyBgColor',
}

export enum BUTTON_ROUND_SIZE {
	large = 'large',
	medium = '',
	small = 'small',
	xsmall = 'xsmall',
}

type ButtonRoundProps = {
	label?: string;
	color?: BUTTON_ROUND_COLOR;
	size?: BUTTON_ROUND_SIZE;
	successMark?: boolean;
} & ButtonHTMLAttributes<HTMLButtonElement>;

const ButtonRound = ({ label, children, color = BUTTON_ROUND_COLOR.accent, size = BUTTON_ROUND_SIZE.medium, className, successMark = false, ...other }: ButtonRoundProps) => {
	return (
		<div className={cls(styles.buttonContainer, className)}>
			<button className={cls(styles.button, styles[color as typeof BUTTON_ROUND_COLOR.grey], styles[size as typeof BUTTON_ROUND_SIZE.large])} {...other}>
				{children}
				{successMark && (
					<div className={styles.successMark}>
						<Correct />
					</div>
				)}
			</button>
			{label && <p className={styles.label}>{label}</p>}
		</div>
	);
};

export default ButtonRound;
