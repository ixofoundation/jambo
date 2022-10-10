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
	const keplrWallet = getKeplr();
	const operaWallet = getOpera();

	return (
		<div className={cls(styles.wallets, className)} {...other}>
			{keplrWallet || operaWallet ? (
				<>
					<h3>Choose wallet</h3>
					{/* {keplrWallet && <Button label="Keysafe" onClick={() => onSelected(WALLET_TYPE.keysafe)} />} */}
					{keplrWallet && <Button label="Keplr" onClick={() => onSelected(WALLET_TYPE.keplr)} />}
					{operaWallet && <Button label="Opera" onClick={() => onSelected(WALLET_TYPE.opera)} />}
				</>
			) : (
				<div>
					<h3>No Wallet Detected</h3>
					<p>Please install the kepler extension or use the dApp on an android mobile Opera browser.</p>
				</div>
			)}
		</div>
	);
};

export default Wallets;
