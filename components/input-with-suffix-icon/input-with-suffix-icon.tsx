import { FC, InputHTMLAttributes, ReactNode } from 'react';
import cls from 'classnames';

import styles from './input-with-suffix-icon.module.scss';

type InputWithSufficIconProps = {
	label?: string;
	Icon: React.ElementType;
	onIconClick?: () => void;
} & InputHTMLAttributes<HTMLInputElement>;

const InputWithSufficIcon: FC<InputWithSufficIconProps> = ({ label, className, Icon, onIconClick, ...other }) => {
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

export default InputWithSufficIcon;
