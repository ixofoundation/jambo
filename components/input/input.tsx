import { FC, InputHTMLAttributes } from 'react';
import cls from 'classnames';

import styles from './input.module.scss';

type InputProps = {
	label?: string;
} & InputHTMLAttributes<HTMLInputElement>;

const Input: FC<InputProps> = ({ label, className, ...other }) => {
	return label ? (
		<label>
			{label}
			<input className={cls(styles.input, className)} {...other} />
		</label>
	) : (
		<input className={cls(styles.input, className)} {...other} />
	);
};

export default Input;
