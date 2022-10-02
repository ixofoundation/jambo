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
	console.log({ operaWallet });

	useEffect(() => {
		setLoaded(true);
		console.log({ operaWallet });
	}, []);

	return loaded ? (
		<div className={cls(className)} {...other}>
			<p>Choose wallet</p>
			{keplrWallet && <Button label="Keplr" onClick={() => onSelected(WALLET_TYPE.keysafe)} />}
			{operaWallet && <Button label="Opera" onClick={() => onSelected(WALLET_TYPE.opera)} />}
			<Button label="Opera" onClick={() => onSelected(WALLET_TYPE.opera)} />
		</div>
	) : (
		<p>loading</p>
	);
};

export default Wallets;
