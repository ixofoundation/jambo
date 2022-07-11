import { FC, InputHTMLAttributes } from 'react';

type FormInputProps = {
	label?: string;
} & InputHTMLAttributes<HTMLInputElement>;

const FormInput: FC<FormInputProps> = ({ label, ...other }) => {
	return label ? (
		<label>
			{label}
			<input {...other} />
		</label>
	) : (
		<input {...other} />
	);
};

export default FormInput;
