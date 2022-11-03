import { HTMLAttributes } from 'react';
import cls from 'classnames';

import styles from './icon-text.module.scss';

type IconTextProps = { Img: any; text: string; imgSize?: number; text2?: string } & HTMLAttributes<HTMLDivElement>;

const IconText = ({ Img, text, text2, imgSize = 40, className, ...other }: IconTextProps) => {
	return (
		<div className={cls(styles.container, className)} {...other}>
			<Img width={imgSize} height={imgSize} />
			<p>{text}</p>
			{<p>{text2}</p>}
		</div>
	);
};

export default IconText;
