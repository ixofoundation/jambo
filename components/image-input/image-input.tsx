import { FC, HTMLAttributes } from 'react';
import cls from 'classnames';

import styles from './image-input.module.scss';

type ImageInputProps = {
	placeholder?: string;
} & HTMLAttributes<HTMLDivElement>;

const ImageInput: FC<ImageInputProps> = ({ placeholder, className, ...other }) => {
	return (
		<div className={cls(styles.imageContainer, className)} {...other}>
			{placeholder}
		</div>
	);
};

export default ImageInput;
