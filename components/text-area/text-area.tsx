import { FC, TextareaHTMLAttributes } from 'react';
import cls from 'classnames';

import styles from './text-area.module.scss';

type TextAreaProps = {
	label?: string;
} & TextareaHTMLAttributes<HTMLTextAreaElement>;

const TextArea: FC<TextAreaProps> = ({ label, className, ...other }) => {
	return label ? (
		<label>
			{label}
			<textarea className={cls(styles.textArea, className)} {...other} />
		</label>
	) : (
		<textarea className={cls(styles.textArea, className)} {...other} />
	);
};

export default TextArea;
