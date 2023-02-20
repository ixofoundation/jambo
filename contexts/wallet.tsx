import { createContext, useState, useEffect, HTMLAttributes, useContext } from 'react';

import { getLocalStorage, setLocalStorage } from '@utils/persistence';
import { queryAllBalances, queryValidators } from '@utils/query';
import { initializeWallet } from '@utils/wallets';
import { BALANCES, WALLET, WALLET_TYPE } from 'types/wallet';
import { KEPLR_CHAIN_INFO_TYPE } from 'types/chain';
import { VALIDATOR } from 'types/validators';
import { QUERY_CLIENT } from 'types/query';
import { USER } from 'types/user';
import { ChainContext } from './chain';

export const WalletContext = createContext({
	wallet: {} as WALLET,
	updateWallet: (newWallet: WALLET) => {},
	fetchAssets: () => {},
	logoutWallet: () => {},
	walletModalVisible: false,
	showWalletModal: () => {},
	hideWalletModal: () => {},
	validators: [] as VALIDATOR[],
	updateValidators: async () => {},
	updateValidatorAvatar: (validatorAddress: string, avatarUrl: string) => {},
});

const DEFAULT_WALLET: WALLET = {
	walletType: undefined,
	user: undefined,
	balances: undefined,
};

export const WalletProvider = ({ children }: HTMLAttributes<HTMLDivElement>) => {
	const [wallet, setWallet] = useState<WALLET>(DEFAULT_WALLET);
	const [walletModalVisible, setWalletModalVisible] = useState<boolean>(false);
	const [loaded, setLoaded] = useState<boolean>(false);
	const [validators, setValidators] = useState<VALIDATOR[]>();
	const { chain, chainInfo, queryClient } = useContext(ChainContext);

	const showWalletModal = () => setWalletModalVisible(true);

	const hideWalletModal = () => setWalletModalVisible(false);

	const updateWallet = (newWallet: WALLET, override: boolean = false) => {
		if (override) setWallet({ ...DEFAULT_WALLET, ...newWallet });
		else setWallet((currentWallet) => ({ ...currentWallet, ...newWallet }));
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
		if (override) updateWallet({ balances: newBalances });
		else
			setWallet((currentWallet) => ({
				...currentWallet,
				balances: currentWallet.balances ? { ...currentWallet.balances, ...newBalances } : newBalances,
			}));
	};

	const initializeWallets = async () => {
		try {
			const user = await initializeWallet(wallet.walletType, chainInfo as KEPLR_CHAIN_INFO_TYPE);
			updateWallet({ user, walletType: wallet.walletType });
		} catch (error) {
			console.error('Initializing wallets error:', error);
		}
	};

	const logoutWallet = () => {
		updateWallet({}, true);
	};

	const fetchAssets = async () => {
		if (!wallet.user?.address || !queryClient) return;
		updateBalances({ loading: true, error: undefined });
		try {
			const balances = await queryAllBalances(queryClient as QUERY_CLIENT, wallet.user.address);
			updateBalances({ balances, loading: false }, true);
		} catch (error) {
			updateBalances({ error: error as string, loading: false });
		}
	};

	const updateValidators = async () => {
		try {
			if (!queryClient?.cosmos || !wallet?.walletType) return;
			const validatorList = await queryValidators(queryClient, wallet);
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

	const updateKeplrWallet = async () => {
		if (loaded && wallet.walletType) initializeWallets();
	};

	useEffect(() => {
		if (loaded) fetchAssets();
	}, [wallet.user?.address, queryClient]);

	useEffect(() => {
		if (loaded) setLocalStorage('wallet', wallet);
	}, [wallet]);

	useEffect(() => {
		if (loaded && wallet.walletType) initializeWallets();
		if (wallet.walletType !== WALLET_TYPE.keplr) {
			window.removeEventListener('keplr_keystorechange', updateKeplrWallet);
		} else {
			window.addEventListener('keplr_keystorechange', updateKeplrWallet);
			return () => window.removeEventListener('keplr_keystorechange', updateKeplrWallet);
		}
	}, [wallet.walletType, chain.chainId, chain.chainNetwork]);

	useEffect(() => {
		if (!chain.chainLoading && loaded && wallet.walletType) initializeWallets();
	}, [chain.chainLoading]);

	useEffect(() => {
		// Comment out below to reset config
		// setLocalStorage('wallet', {});
		const persistedWallet = getLocalStorage<WALLET>('wallet');
		setLoaded(true);
		if (persistedWallet) setWallet(persistedWallet);
	}, []);

	const value = {
		wallet,
		walletModalVisible,
		showWalletModal,
		hideWalletModal,
		updateWallet,
		fetchAssets,
		logoutWallet,
		updateValidators,
		validators: validators as VALIDATOR[],
		updateValidatorAvatar,
	};

	return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
};
