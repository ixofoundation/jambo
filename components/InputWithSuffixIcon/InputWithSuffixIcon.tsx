import { FC, InputHTMLAttributes, ReactNode } from 'react';
import cls from 'classnames';

import styles from './InputWithSuffixIcon.module.scss';

type InputWithSuffixIconProps = {
	label?: string;
	Icon: React.ElementType;
	onIconClick?: () => void;
} & InputHTMLAttributes<HTMLInputElement>;

const InputWithSuffixIcon: FC<InputWithSuffixIconProps> = ({ label, className, Icon, onIconClick, ...other }) => {
	return (
		<label className={cls(styles.label, className)}>
			{label}
			<div className={styles.inputContainer}>
				<Icon onClick={onIconClick} />
				<input className={styles.input} {...other} />
			</div>
		</label>
	);
};

export default InputWithSuffixIcon;
