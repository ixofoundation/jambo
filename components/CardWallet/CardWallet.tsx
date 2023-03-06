import { HTMLAttributes } from 'react';
import cls from 'classnames';

import styles from './CardWallet.module.scss';
import Image from 'next/image';
import Card from '@components/Card/Card';

type WalletCardProps = {
  img?: string;
  Img?: any;
  name?: string;
  imgWidth?: number;
} & HTMLAttributes<HTMLDivElement>;

export const WalletCard = ({ children, className, img, Img, name, imgWidth = 40, ...other }: WalletCardProps) => {
  return (
    <Card className={cls(styles.walletCard, className)} {...other}>
      {Img ? (
        <Img width={imgWidth} height={40} />
      ) : img ? (
        <Image src={img} alt={name} width={imgWidth} height={40} />
      ) : (
        <div />
      )}
      {!!name && <p>{name}</p>}
    </Card>
  );
};

export default WalletCard;
