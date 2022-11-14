import { HTMLAttributes } from 'react';
import cls from 'classnames';

import styles from './card.module.scss';
import Image from 'next/image';

type CardProps = {} & HTMLAttributes<HTMLDivElement>;

const Card = ({ children, className, ...other }: CardProps) => {
	return (
		<div className={cls(styles.card, className)} {...other}>
			{children}
		</div>
	);
};

export default Card;
