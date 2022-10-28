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

type WalletCardProps = {
	img?: string;
	Img?: any;
	name: string;
} & HTMLAttributes<HTMLDivElement>;

export const WalletCard = ({ children, className, img, Img, name, ...other }: WalletCardProps) => {
	return (
		<div className={cls(styles.card, styles.walletCard, className)} {...other}>
			{Img ? <Img width={40} height={40} /> : img ? <Image src={img} alt={name} width={40} height={40} /> : <div />}
			<p>{name}</p>
		</div>
	);
};

export default Card;
