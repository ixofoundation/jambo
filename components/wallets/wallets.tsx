import { HTMLAttributes, useState, useEffect } from 'react';
import cls from 'classnames';

import styles from './wallets.module.scss';
import { getKeplr } from '@utils/kepl';
import { getKeysafe } from '@utils/keysafe';
import { WALLET_TYPE } from 'types/wallet';
import Button from '@components/button/button';

type WalletsProps = {
	onSelected: (type: WALLET_TYPE) => void;
} & HTMLAttributes<HTMLDivElement>;

const Wallets = ({ onSelected, className, ...other }: WalletsProps) => {
	const [loaded, setLoaded] = useState(false);
	const keplrWallet = getKeplr();
	const keysafeWallet = getKeysafe();

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
			{keysafeWallet && (
				<Button label="Kepl" onClick={() => onSelected(WALLET_TYPE.keplr)}>
					<p>Kepl</p>
				</Button>
			)}
		</div>
	) : (
		<p>loading</p>
	);
};

export default Wallets;
