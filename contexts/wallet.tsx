import { createContext, useState, useEffect, HTMLAttributes } from 'react';

import { getLocalStorage, setLocalStorage } from '@utils/persistence';
import { WALLET } from 'types/wallet';
import { initializeWallet } from '@utils/wallets';
import { getBalances } from '@utils/client';
import { USER } from 'types/user';

export const WalletContext = createContext({ wallet: {} as WALLET, updateWallet: (newWallet: WALLET) => {} });

export const WalletProvider = ({ children }: HTMLAttributes<HTMLDivElement>) => {
	const [wallet, setWallet] = useState<WALLET>({});
	const [loaded, setLoaded] = useState<boolean>(false);

	const updateWallet = (newWallet: WALLET) => {
		setWallet(currentWallet => ({ ...currentWallet, ...newWallet }));
	};

	const updateUser = (newUser: USER, override: boolean = false) => {
		if (override) setWallet(currentWallet => ({ ...currentWallet, user: newUser }));
		else setWallet(currentWallet => ({ ...currentWallet, user: currentWallet.user ? { ...currentWallet.user, ...newUser } : newUser }));
	};

	const initializeWallets = async () => {
		const user = await initializeWallet(wallet);
		updateWallet({ user });
	};

	const fetchAssets = async () => {
		if (!wallet.user?.address) return;
		const balances = await getBalances(wallet.user.address);
		updateUser({ ...wallet.user, balances });
	};

	useEffect(() => {
		if (loaded && wallet.user?.address) fetchAssets();
	}, [wallet.user?.address]);

	useEffect(() => {
		if (loaded) setLocalStorage('wallet', wallet);
		if (loaded) console.log({ wallet });
	}, [wallet]);

	useEffect(() => {
		if (loaded && wallet.walletType) initializeWallets();
	}, [wallet.walletType]);

	useEffect(() => {
		// Comment out below to reset config
		// setLocalStorage('wallet', {});
		const persistedWallet = getLocalStorage<WALLET>('wallet');
		setLoaded(true);
		if (persistedWallet) setWallet(persistedWallet);
	}, []);

	const value = { wallet, updateWallet };
	return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
};
