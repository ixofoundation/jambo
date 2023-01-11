import React, { useEffect, useState } from 'react';
import Image, { ImageProps } from 'next/image';

interface ImageWithFallbackProps extends ImageProps {
	fallbackSrc: string;
	alt?: string;
}

const ImageWithFallback = ({ src, fallbackSrc, alt, ...rest }: ImageWithFallbackProps) => {
	const [imgSrc, setImgSrc] = useState(src);

	useEffect(() => {
		setImgSrc(src);
	}, [src]);

	return (
		<Image
			{...rest}
			src={imgSrc}
			alt={alt}
			onError={() => {
				setImgSrc(fallbackSrc);
			}}
		/>
	);
};

export default ImageWithFallback;
