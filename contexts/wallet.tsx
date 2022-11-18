import { createContext, useState, useEffect, HTMLAttributes, useRef } from 'react';
import { createQueryClient } from '@ixo/impactxclient-sdk';

import { getLocalStorage, setLocalStorage } from '@utils/persistence';
import { BALANCES, WALLET } from 'types/wallet';
import { initializeWallet } from '@utils/wallets';
import { getBalances } from '@utils/client';
import { USER } from 'types/user';
import { BLOCKCHAIN_RPC_URL } from '@constants/chains';

export const WalletContext = createContext({
	wallet: {} as WALLET,
	updateWallet: (newWallet: WALLET) => {},
	fetchAssets: () => {},
	queryClient: {} as any,
});

export const WalletProvider = ({ children }: HTMLAttributes<HTMLDivElement>) => {
	const [wallet, setWallet] = useState<WALLET>({});
	const [loaded, setLoaded] = useState<boolean>(false);
	const queryClientRef = useRef<any>();

	const updateWallet = (newWallet: WALLET) => {
		setWallet((currentWallet) => ({ ...currentWallet, ...newWallet }));
	};

	const updateUser = (newUser: USER, override: boolean = false) => {
		if (override) setWallet((currentWallet) => ({ ...currentWallet, user: newUser }));
		else
			setWallet((currentWallet) => ({
				...currentWallet,
				user: currentWallet.user ? { ...currentWallet.user, ...newUser } : newUser,
			}));
	};

	const updateBalances = (newBalances: BALANCES, override: boolean = false) => {
		if (override) setWallet((currentWallet) => ({ ...currentWallet, balances: newBalances }));
		else
			setWallet((currentWallet) => ({
				...currentWallet,
				balances: currentWallet.balances ? { ...currentWallet.balances, ...newBalances } : newBalances,
			}));
	};

	const initializeWallets = async () => {
		const user = await initializeWallet(wallet);
		updateWallet({ user });
	};

	const fetchAssets = async () => {
		if (!wallet.user?.address) return;
		updateBalances({ loading: true, error: undefined });
		try {
			const balances = await getBalances(wallet.user.address);
			updateBalances({ balances, loading: false });
		} catch (error) {
			updateBalances({ error: error as string, loading: false });
		}
	};

	const initializeQueryClient = async () => {
		if (queryClientRef.current) return;

		try {
			const queryClient = await createQueryClient(BLOCKCHAIN_RPC_URL);
			queryClientRef.current = queryClient;
		} catch (error) {
			console.error(error);
		}
	};

	useEffect(() => {
		if (loaded && wallet.user?.address) fetchAssets();
	}, [wallet.user?.address]);

	useEffect(() => {
		if (loaded) setLocalStorage('wallet', wallet);
		// if (loaded) console.log({ wallet });
	}, [wallet]);

	useEffect(() => {
		if (loaded && wallet.walletType) initializeWallets();
	}, [wallet.walletType]);

	useEffect(() => {
		initializeQueryClient();
		// Comment out below to reset config
		// setLocalStorage('wallet', {});
		const persistedWallet = getLocalStorage<WALLET>('wallet');
		setLoaded(true);
		if (persistedWallet) setWallet(persistedWallet);
	}, []);

	const value = { wallet, updateWallet, fetchAssets, queryClient: queryClientRef.current ?? {} };
	return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
};
