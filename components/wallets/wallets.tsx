import { HTMLAttributes, useState, useEffect } from 'react';
import cls from 'classnames';

import styles from './wallets.module.scss';
import { getKeplr } from '@utils/kepl';
import { getOpera } from '@utils/opera';
import { WALLET_TYPE } from 'types/wallet';
import Button from '@components/button/button';

type WalletsProps = {
	onSelected: (type: WALLET_TYPE) => void;
} & HTMLAttributes<HTMLDivElement>;

const Wallets = ({ onSelected, className, ...other }: WalletsProps) => {
	const [loaded, setLoaded] = useState(false);
	const keplrWallet = getKeplr();
	const operaWallet = getOpera();

	useEffect(() => {
		setLoaded(true);
	}, []);

	return loaded ? (
		<div className={cls(styles.wallets, className)} {...other}>
			<h3>Choose wallet</h3>
			{/* {keplrWallet && <Button label="Keysafe" onClick={() => onSelected(WALLET_TYPE.keysafe)} />} */}
			{keplrWallet && <Button label="Keplr" onClick={() => onSelected(WALLET_TYPE.keplr)} />}
			{operaWallet && <Button label="Opera" onClick={() => onSelected(WALLET_TYPE.opera)} />}
		</div>
	) : (
		<div />
	);
};

export default Wallets;
