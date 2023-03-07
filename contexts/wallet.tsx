import { createContext, useState, useEffect, HTMLAttributes, useContext } from 'react';

import Loader from '@components/Loader/Loader';
import { getLocalStorage, setLocalStorage } from '@utils/persistence';
import { initializeWallet } from '@utils/wallets';
import {
  queryAllBalances,
  queryDelegationTotalRewards,
  queryDelegatorDelegations,
  queryDelegatorUnbondingDelegations,
  queryValidators,
} from '@utils/query';
import { WALLET, WALLET_TYPE, WALLET_ASSETS, WALLET_KEYS } from 'types/wallet';
import { KEPLR_CHAIN_INFO_TYPE } from 'types/chain';
import { VALIDATOR } from 'types/validators';
import { QUERY_CLIENT } from 'types/query';
import { ChainContext } from './chain';
import useModalState from '@hooks/modalState';
import { linkDelegationsAndRewards } from '@utils/validators';

export const WalletContext = createContext({
  wallet: {} as WALLET,
  updateWalletType: (newWalletType: WALLET_TYPE) => {},
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
  const [walletModalVisible, showWalletModal, hideWalletModal] = useModalState(false);
  const [loaded, setLoaded] = useState<boolean>(false);
  const [validators, setValidators] = useState<VALIDATOR[]>();
  const { chain, chainInfo, queryClient } = useContext(ChainContext);

  const updateWallet = (newWallet: WALLET, override: boolean = false) => {
    if (override) setWallet({ ...DEFAULT_WALLET, ...newWallet });
    else setWallet((currentWallet) => ({ ...currentWallet, ...newWallet }));
  };

  const updateWalletAsset =
    (asset: WALLET_KEYS) =>
    (newValue: WALLET_ASSETS, override: boolean = false) => {
      if (override) updateWallet({ [asset]: newValue });
      else
        setWallet((currentWallet) => ({
          ...currentWallet,
          [asset]: currentWallet[asset] ? { ...currentWallet[asset], ...newValue } : newValue,
        }));
    };

  const updateWalletType = (newWalletType: WALLET_TYPE) => updateWallet({ walletType: newWalletType });
  const updateBalances = updateWalletAsset('balances');
  const updateDelegations = updateWalletAsset('delegations');
  const updateRewards = updateWalletAsset('rewards');
  const updateUnbondingDelegations = updateWalletAsset('unbonding');

  const initializeWallets = async () => {
    try {
      const user = await initializeWallet(wallet.walletType, chainInfo as KEPLR_CHAIN_INFO_TYPE);
      updateWallet({ user });
    } catch (error) {
      console.error('Initializing wallets error:', error);
    }
  };

  const logoutWallet = () => {
    updateWallet({}, true);
  };

  const fetchUserBalances = async () => {
    if (!wallet.user?.address || !queryClient) return;
    updateBalances({ loading: true, error: undefined });
    try {
      const balances = await queryAllBalances(queryClient as QUERY_CLIENT, wallet.user.address);
      updateBalances({ balances, loading: false }, true);
    } catch (error) {
      updateBalances({ error: error as string, loading: false });
    }
  };
  const fetchUserDelegations = async () => {
    if (!wallet.user?.address || !queryClient) return;
    updateDelegations({ loading: true, error: undefined });
    try {
      const delegations = await queryDelegatorDelegations(queryClient as QUERY_CLIENT, wallet.user.address);
      updateDelegations({ delegations, loading: false }, true);
    } catch (error) {
      updateDelegations({ error: error as string, loading: false });
    }
  };
  const fetchUserDelegationRewards = async () => {
    if (!wallet.user?.address || !queryClient) return;
    updateRewards({ loading: true, error: undefined });
    try {
      const rewards = await queryDelegationTotalRewards(queryClient as QUERY_CLIENT, wallet.user.address);
      updateRewards({ rewards, loading: false }, true);
    } catch (error) {
      updateRewards({ error: error as string, loading: false });
    }
  };
  const fetchUserUnbondingDelegations = async () => {
    if (!wallet.user?.address || !queryClient) return;
    updateUnbondingDelegations({ loading: true, error: undefined });
    try {
      const unbonding = await queryDelegatorUnbondingDelegations(queryClient as QUERY_CLIENT, wallet.user.address);
      updateUnbondingDelegations({ unbonding, loading: false }, true);
    } catch (error) {
      updateUnbondingDelegations({ error: error as string, loading: false });
    }
  };

  const fetchAssets = async () => {
    fetchUserBalances();
    fetchUserDelegations();
    fetchUserDelegationRewards();
    fetchUserUnbondingDelegations();
  };

  const updateValidators = async () => {
    try {
      if (!queryClient?.cosmos || !wallet?.walletType) return;
      const validatorList = await queryValidators(queryClient);
      setValidators((prevState) =>
        validatorList.map((validator: VALIDATOR) => {
          const prevValidator = prevState?.find((v) => v.address === validator.address);
          if (prevValidator) {
            return { ...prevValidator, ...validator, avatarUrl: prevValidator.avatarUrl };
          }
          return validator;
        }),
      );
      fetchUserDelegations();
      fetchUserDelegationRewards();
      fetchUserUnbondingDelegations();
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
    // @ts-ignore
    if (!queryClient && validators?.length) setValidators();
  }, [wallet.user?.address, queryClient, chain.chainId]);

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
    updateWalletType,
    fetchAssets,
    logoutWallet,
    updateValidators,
    validators: linkDelegationsAndRewards(
      validators,
      wallet.delegations?.delegations,
      wallet.rewards?.rewards?.rewards,
    ) as VALIDATOR[],
    updateValidatorAvatar,
  };

  return <WalletContext.Provider value={value}>{!loaded ? <Loader /> : children}</WalletContext.Provider>;
};
