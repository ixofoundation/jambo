import { createContext, useState, useEffect, HTMLAttributes, useContext } from 'react';
import { ChainNetwork } from '@ixo/impactxclient-sdk/types/custom_queries/chain.types';
import cls from 'classnames';

import utilsStyles from '@styles/utils.module.scss';
import { SiteHeader } from '@components/Header/Header';
import Loader from '@components/Loader/Loader';
import { WALLET, WALLET_TYPE, WALLET_DELEGATIONS, WALLET_DELEGATION_REWARDS } from 'types/wallet';
import { KEPLR_CHAIN_INFO_TYPE } from 'types/chain';
import { VALIDATOR } from 'types/validators';
import { getLocalStorage, setLocalStorage } from '@utils/persistence';
import { generateValidators } from '@utils/validators';
import { initializeWallet } from '@utils/wallets';
import {
  queryAllBalances,
  queryDelegationTotalRewards,
  queryDelegatorDelegations,
  queryDelegatorUnbondingDelegations,
  queryValidators,
} from '@utils/query';
import { ChainContext } from './chain';
import useWalletData from '@hooks/useWalletData';

export const WalletContext = createContext({
  wallet: {} as WALLET,
  updateWalletType: (newWalletType: WALLET_TYPE) => {},
  fetchAssets: () => {},
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

  // const clearWallet = () =>

  const fetchAssets = () => {
    fetchBalances();
    fetchDelegations();
    fetchDelegationRewards();
    fetchUnbondingDelegations();
  };
  const clearAssets = () => {
    clearBalances();
    clearDelegations();
    clearDelegationRewards();
    clearUnbondingDelegations();
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
    wallet: {
      ...wallet,
      balances,
      delegations,
      delegationRewards,
      unbondingDelegations,
      loading:
        balances.loading ||
        delegations.loading ||
        delegationRewards.loading ||
        unbondingDelegations.loading ||
        chain.chainLoading,
    } as WALLET,
    updateWalletType,
    fetchAssets,
    clearAssets,
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
          <br />
          <br />
          <div className={utilsStyles.spacer2} />
          <Loader size={25} />
        </main>
      ) : (
        children
      )}
    </WalletContext.Provider>
  );
};
