import { FC, InputHTMLAttributes } from 'react';
import cls from 'classnames';

import styles from './form-input.module.scss';

type FormInputProps = {
	label?: string;
} & InputHTMLAttributes<HTMLInputElement>;

const FormInput: FC<FormInputProps> = ({ label, className, ...other }) => {
	return label ? (
		<label>
			{label}
			<input className={cls(styles.formInput, className)} {...other} />
		</label>
	) : (
		<input className={cls(styles.formInput, className)} {...other} />
	);
};

export default FormInput;
