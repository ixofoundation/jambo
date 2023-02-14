import { ButtonHTMLAttributes } from 'react';

import styles from './Button.module.scss';

type ButtonProps = {
	label: string;
} & ButtonHTMLAttributes<HTMLButtonElement>;

const Button = ({ label, ...other }: ButtonProps) => {
	return (
		<button className={styles.button} {...other}>
			{label}
		</button>
	);
};

export default Button;
