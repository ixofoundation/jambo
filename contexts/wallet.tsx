import { createContext, HTMLAttributes, useContext, useEffect, useState } from 'react';

import { ChainNetwork } from '@ixo/impactxclient-sdk/types/custom_queries/chain.types';
import cls from 'classnames';

import { SiteHeader } from '@components/Header/Header';
import Loader from '@components/Loader/Loader';
import { EVENT_LISTENER_TYPE } from '@constants/events';
import useWalletData from '@hooks/useWalletData';
import utilsStyles from '@styles/utils.module.scss';
import { getLocalStorage, setLocalStorage } from '@utils/persistence';
import {
  queryAllBalances,
  queryDelegationTotalRewards,
  queryDelegatorDelegations,
  queryDelegatorUnbondingDelegations,
  queryTokenBalances,
  queryValidators,
} from '@utils/query';
import { generateValidators } from '@utils/validators';
import { initializeWallet } from '@utils/wallets';
import { KEPLR_CHAIN_INFO_TYPE } from 'types/chain';
import { VALIDATOR } from 'types/validators';
import { WALLET, WALLET_DELEGATION_REWARDS, WALLET_DELEGATIONS, WALLET_TYPE } from 'types/wallet';

import { ChainContext } from './chain';

export const WalletContext = createContext({
  wallet: {} as WALLET,
  updateWalletType: (newWalletType: WALLET_TYPE) => {},
  fetchAssets: () => {},
  fetchBalances: () => {},
  fetchTokenBalances: () => {},
  clearAssets: () => {},
  updateChainId: (chainId: string) => {},
  updateChainNetwork: (chainNetwork: ChainNetwork) => {},
  logoutWallet: () => {},
  validators: [] as VALIDATOR[],
  updateValidators: async () => {},
  updateValidatorAvatar: (validatorAddress: string, avatarUrl: string) => {},
});

const DEFAULT_WALLET: WALLET = {
  walletType: undefined,
  user: undefined,
};

export const WalletProvider = ({ children }: HTMLAttributes<HTMLDivElement>) => {
  const [wallet, setWallet] = useState<WALLET>(DEFAULT_WALLET);
  const [loaded, setLoaded] = useState<boolean>(false);
  const [validators, setValidators] = useState<VALIDATOR[]>();
  const { chain, chainInfo, queryClient, updateChainId, updateChainNetwork } = useContext(ChainContext);
  const [balances, fetchBalances, clearBalances] = useWalletData(queryAllBalances, wallet?.user?.address);
  const [delegations, fetchDelegations, clearDelegations] = useWalletData(
    queryDelegatorDelegations,
    wallet?.user?.address,
  );
  const [delegationRewards, fetchDelegationRewards, clearDelegationRewards] = useWalletData(
    queryDelegationTotalRewards,
    wallet?.user?.address,
  );
  const [unbondingDelegations, fetchUnbondingDelegations, clearUnbondingDelegations] = useWalletData(
    queryDelegatorUnbondingDelegations,
    wallet?.user?.address,
  );
  const [tokenBalances, fetchTokenBalances, clearTokenBalances] = useWalletData(
    queryTokenBalances,
    wallet?.user?.address,
  );

  const updateWallet = (newWallet: WALLET, override: boolean = false) => {
    if (override) setWallet({ ...DEFAULT_WALLET, ...newWallet });
    else setWallet((currentWallet) => ({ ...currentWallet, ...newWallet }));
  };

  const updateWalletType = (newWalletType: WALLET_TYPE) => updateWallet({ walletType: newWalletType });

  const initializeWallets = async () => {
    try {
      const user = await initializeWallet(wallet.walletType, chainInfo as KEPLR_CHAIN_INFO_TYPE);
      updateWallet({ user });
    } catch (error) {
      console.error('Initializing wallets error:', error);
    }
  };

  const logoutWallet = () => updateWallet({}, true);

  const fetchAssets = () => {
    fetchBalances();
    fetchDelegations();
    fetchDelegationRewards();
    fetchUnbondingDelegations();
    fetchTokenBalances();
  };
  const clearAssets = () => {
    clearBalances();
    clearDelegations();
    clearDelegationRewards();
    clearUnbondingDelegations();
    clearTokenBalances();
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
      fetchDelegations();
      fetchDelegationRewards();
      fetchUnbondingDelegations();
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

  const updateWalletConnectWallet = async () => {
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
    if (wallet.walletType === WALLET_TYPE.keplr) {
      window.addEventListener(EVENT_LISTENER_TYPE.wc_sessionupdate, updateWalletConnectWallet);
      window.removeEventListener(EVENT_LISTENER_TYPE.wc_sessiondelete, logoutWallet);
      window.addEventListener(EVENT_LISTENER_TYPE.keplr_keystorechange, updateKeplrWallet);

      return () => window.removeEventListener(EVENT_LISTENER_TYPE.keplr_keystorechange, updateKeplrWallet);
    } else if (wallet.walletType === WALLET_TYPE.walletConnect) {
      window.removeEventListener(EVENT_LISTENER_TYPE.keplr_keystorechange, updateKeplrWallet);
      window.addEventListener(EVENT_LISTENER_TYPE.wc_sessionupdate, updateWalletConnectWallet);
      window.addEventListener(EVENT_LISTENER_TYPE.wc_sessiondelete, logoutWallet);

      return () => {
        window.removeEventListener(EVENT_LISTENER_TYPE.wc_sessionupdate, updateWalletConnectWallet);
        window.removeEventListener(EVENT_LISTENER_TYPE.wc_sessiondelete, logoutWallet);
      };
    } else {
      window.removeEventListener(EVENT_LISTENER_TYPE.keplr_keystorechange, updateKeplrWallet);
      window.removeEventListener(EVENT_LISTENER_TYPE.wc_sessionupdate, updateWalletConnectWallet);
      window.removeEventListener(EVENT_LISTENER_TYPE.wc_sessiondelete, logoutWallet);
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
    wallet: {
      ...wallet,
      balances,
      tokenBalances,
      delegations,
      delegationRewards,
      unbondingDelegations,
      loading:
        balances.loading ||
        delegations.loading ||
        delegationRewards.loading ||
        unbondingDelegations.loading ||
        tokenBalances.loading ||
        chain.chainLoading,
    } as WALLET,
    updateWalletType,
    fetchAssets,
    clearAssets,
    fetchBalances,
    fetchTokenBalances,
    updateChainId: updateChainId(clearAssets),
    updateChainNetwork: updateChainNetwork(clearAssets),
    logoutWallet,
    updateValidators,
    updateValidatorAvatar,
    validators: generateValidators(
      validators,
      (delegations as WALLET_DELEGATIONS)?.data,
      (delegationRewards as WALLET_DELEGATION_REWARDS)?.data?.rewards,
    ) as VALIDATOR[],
  };

  return (
    <WalletContext.Provider value={value}>
      {!loaded ? (
        <main className={cls(utilsStyles.main, utilsStyles.columnCenter)}>
          <SiteHeader displayLogo displayName />
          <div className={utilsStyles.spacer3} />
          <Loader size={30} />
        </main>
      ) : (
        children
      )}
    </WalletContext.Provider>
  );
};
