import { createContext, useState, useEffect, HTMLAttributes } from 'react';

import { getLocalStorage, setLocalStorage } from '@utils/persistence';
import { WALLET } from 'types/wallet';
import { initializeWallet } from '@utils/wallets';

export const WalletContext = createContext({ wallet: {} as WALLET, updateWallet: (newWallet: WALLET) => {} });

export const WalletProvider = ({ children }: HTMLAttributes<HTMLDivElement>) => {
	const [wallet, setWallet] = useState<WALLET>({});
	// const [loaded, setLoaded] = useState<boolean>(false);

	const updateWallet = (newWallet: {}) => {
		setWallet(currentWallet => ({ ...currentWallet, ...newWallet }));
	};

	const initializeWallets = async () => {
		const user = await initializeWallet(wallet);
		console.log({ user });
		updateWallet({ user });
	};

	// useEffect(() => {
	// if (loaded) setLocalStorage('wallet', wallet);
	// console.log({ wallet });
	// }, [wallet]);

	useEffect(() => {
		// if (loaded && wallet.walletType) initializeWallets();
		if (wallet.walletType) initializeWallets();
	}, [wallet.walletType]);

	// useEffect(() => {
	// Comment out below to reset config
	// setLocalStorage('wallet', {});
	// const persistedWallet = getLocalStorage<WALLET>('wallet');
	// setLoaded(true);
	// if (persistedWallet) setWallet(persistedWallet);
	// }, []);

	const value = { wallet, updateWallet };
	return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
};
