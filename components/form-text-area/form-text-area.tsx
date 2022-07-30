import { FC, TextareaHTMLAttributes } from 'react';
import cls from 'classnames';

import styles from './form-text-area.module.scss';

type FormTextAreaProps = {
	label?: string;
} & TextareaHTMLAttributes<HTMLTextAreaElement>;

const FormTextArea: FC<FormTextAreaProps> = ({ label, className, ...other }) => {
	return label ? (
		<label>
			{label}
			<textarea className={cls(styles.formTextArea, className)} {...other} />
		</label>
	) : (
		<textarea className={cls(styles.formTextArea, className)} {...other} />
	);
};

export default FormTextArea;
