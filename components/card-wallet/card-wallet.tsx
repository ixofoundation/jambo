import { HTMLAttributes } from 'react';
import cls from 'classnames';

import styles from './card-wallet.module.scss';
import Image from 'next/image';
import Card from '@components/card/card';

type WalletCardProps = {
	img?: string;
	Img?: any;
	name: string;
} & HTMLAttributes<HTMLDivElement>;

export const WalletCard = ({ children, className, img, Img, name, ...other }: WalletCardProps) => {
	return (
		<Card className={cls(styles.walletCard, className)} {...other}>
			{Img ? <Img width={40} height={40} /> : img ? <Image src={img} alt={name} width={40} height={40} /> : <div />}
			<p>{name}</p>
		</Card>
	);
};

export default WalletCard;
