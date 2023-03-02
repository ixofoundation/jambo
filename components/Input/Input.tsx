import { FC, InputHTMLAttributes } from 'react';
import cls from 'classnames';

import styles from './Input.module.scss';
import { CURRENCY } from 'types/wallet';
import { calculateMaxTokenAmount } from '@utils/currency';

type InputProps = {
	label?: string;
	align?: 'start' | 'left' | 'center' | 'right' | 'end';
} & InputHTMLAttributes<HTMLInputElement>;

const Input: FC<InputProps> = ({ label, align = 'start', className, ...other }) => {
	return label ? (
		<label className={styles.label}>
			{label}
			<input
				className={cls(
					styles.input,
					align === 'end' || align === 'right'
						? styles.endAlign
						: align === 'center'
						? styles.centerAlign
						: styles.startAlign,
					className,
				)}
				{...other}
			/>
		</label>
	) : (
		<input
			className={cls(
				styles.input,
				align === 'end' || align === 'right'
					? styles.endAlign
					: align === 'center'
					? styles.centerAlign
					: styles.startAlign,
				className,
			)}
			{...other}
		/>
	);
};

export default Input;

type InputWithMaxProps = {
	maxAmount?: string;
	maxDenom?: string;
	onMaxClick: (amount: string) => void;
} & InputProps;

export const InputWithMax = ({ maxAmount = '', maxDenom = '-', onMaxClick, ...other }: InputWithMaxProps) => {
	const handleMaxClick = () => onMaxClick(maxAmount?.replace(/\,/g, '') ?? '0');

	return (
		<>
			<p className={cls(styles.max, styles.endAlign)} onClick={handleMaxClick}>
				{maxAmount} {maxDenom} MAX
			</p>
			<Input {...other} />
		</>
	);
};
