import { createContext, useState, useEffect, HTMLAttributes, useRef } from 'react';

import { getLocalStorage, setLocalStorage } from '@utils/persistence';
import { BALANCES, WALLET } from 'types/wallet';
import { initializeWallet } from '@utils/wallets';
import { queryAllBalances } from '@utils/query';
import { USER } from 'types/user';
import { VALIDATOR } from 'types/validators';
import { initializeQueryClient, queryValidators, QUERY_CLIENT } from '@utils/query';

export const WalletContext = createContext({
	wallet: {} as WALLET,
	updateWallet: (newWallet: WALLET) => {},
	fetchAssets: () => {},
	queryClient: {} as any,
	updateValidators: async () => {},
	validators: [] as VALIDATOR[],
	updateValidatorAvatar: (validatorAddress: string, avatarUrl: string) => {},
});

export const WalletProvider = ({ children }: HTMLAttributes<HTMLDivElement>) => {
	const [wallet, setWallet] = useState<WALLET>({});
	const [loaded, setLoaded] = useState<boolean>(false);
	const [validators, setValidators] = useState<VALIDATOR[]>();
	const queryClientRef = useRef<QUERY_CLIENT | undefined>();

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
		try {
			const user = await initializeWallet(wallet);
			updateWallet({ user });
			const queryClient = await initializeQueryClient(queryClientRef?.current);
			queryClientRef.current = queryClient;
		} catch (error) {
			console.error('Initializing wallets error:', error);
		}
	};

	const fetchAssets = async () => {
		if (!wallet.user?.address) return;
		updateBalances({ loading: true, error: undefined });
		try {
			const balances = await queryAllBalances(queryClientRef.current as QUERY_CLIENT, wallet.user.address);
			updateBalances({ balances, loading: false });
		} catch (error) {
			updateBalances({ error: error as string, loading: false });
		}
	};

	const updateValidators = async () => {
		try {
			if (!queryClientRef?.current?.cosmos || !wallet?.walletType) return;
			const validatorList = await queryValidators(queryClientRef.current, wallet);
			setValidators((prevState) =>
				validatorList.map((validator: VALIDATOR) => {
					const prevValidator = prevState?.find((v) => v.address === validator.address);
					if (prevValidator) {
						return { ...prevValidator, ...validator, avatarUrl: prevValidator.avatarUrl };
					}
					return validator;
				}),
			);
		} catch (error) {
			console.error(error);
		}
	};

	const updateValidatorAvatar = async (validatorAddress: string, avatarUrl: string) => {
		if (!validators?.length) return;
		const validatorIndex = validators.findIndex((v) => v.address === validatorAddress);
		if (validatorIndex < 0) return;

		setValidators((prevState: VALIDATOR[] | undefined) =>
			!prevState
				? prevState
				: [
						...prevState.slice(0, validatorIndex),
						{ ...prevState[validatorIndex], avatarUrl },
						...prevState.slice(validatorIndex + 1),
				  ],
		);
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
		// Comment out below to reset config
		// setLocalStorage('wallet', {});
		const persistedWallet = getLocalStorage<WALLET>('wallet');
		setLoaded(true);
		if (persistedWallet) setWallet(persistedWallet);
	}, []);

	const value = {
		wallet,
		updateWallet,
		fetchAssets,
		queryClient: queryClientRef.current ?? {},
		updateValidators,
		validators: validators as VALIDATOR[],
		updateValidatorAvatar,
	};

	return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
};
