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
		<div className={cls(className)} {...other}>
			<p>Choose wallet</p>
			{keplrWallet && (
				<Button label="KeySafe" onClick={() => onSelected(WALLET_TYPE.keysafe)}>
					<p>KeySafe</p>
				</Button>
			)}
			{operaWallet && (
				<Button label="Kepl" onClick={() => onSelected(WALLET_TYPE.opera)}>
					<p>Opera</p>
				</Button>
			)}
		</div>
	) : (
		<p>loading</p>
	);
};

export default Wallets;
