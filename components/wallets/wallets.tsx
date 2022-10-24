import { HTMLAttributes, useState, useEffect } from 'react';
import cls from 'classnames';

import styles from './wallets.module.scss';
import { getKeplr } from '@utils/keplr';
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
			{operaWallet || keplrWallet ? (
				<>
					<h3>Choose wallet</h3>
					{/* {keysafe && <Button label="Keysafe" onClick={() => onSelected(WALLET_TYPE.keysafe)} />} */}
					{/* <Button label="Wallet Connect" onClick={() => onSelected(WALLET_TYPE.walletConnect)} /> */}
					{keplrWallet && <Button label="Keplr" onClick={() => onSelected(WALLET_TYPE.keplr)} />}
					{operaWallet && <Button label="Opera" onClick={() => onSelected(WALLET_TYPE.opera)} />}
				</>
			) : (
				<div>
					<h3>No Wallet Detected</h3>
					<p>Please ensure to use the dApp on an Android mobile Opera browser.</p>
					<p>Sorry for the inconvenience, more wallets are being added soon.</p>
					{/* <p>Please install the kepler extension or use the dApp on an android mobile Opera browser.</p> */}
				</div>
			)}
		</div>
	);
};

export default Wallets;
