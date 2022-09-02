import { ChangeEvent, FC, HTMLAttributes, useRef } from 'react';
import cls from 'classnames';
import Image from 'next/image';

import styles from './image-input.module.scss';
import { file_to_b64 } from '@utils/encoding';

type ImageInputProps = {
	placeholder?: string;
	onImageUploaded?: (imageData: string) => void;
	image?: string;
} & HTMLAttributes<HTMLDivElement>;

const ImageInput: FC<ImageInputProps> = ({ placeholder, className, onImageUploaded, image, ...other }) => {
	const inputRef = useRef<HTMLInputElement>(null);

	const handleChange = async (event: ChangeEvent<HTMLInputElement>) => {
		if (event.target.files && event.target.files.length > 0 && onImageUploaded) {
			console.log(event.target.files[0]);
			onImageUploaded(await file_to_b64(event.target.files[0]));
		}
	};

	const fileUpload = () => inputRef.current?.click();

	return (
		<div className={cls(styles.imageContainer, className)} onClick={fileUpload} {...other}>
			{placeholder}
			{image ? <Image src={image} layout="fill" /> : null}
			{onImageUploaded ? <input hidden ref={inputRef} required type="file" name="image" onChange={handleChange} accept="image/*" /> : null}
		</div>
	);
};

export default ImageInput;
