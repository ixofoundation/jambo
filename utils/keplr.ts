import { ChainInfo, Keplr } from '@keplr-wallet/types';

import * as Toast from '@components/Toast/Toast';
import { sendTransaction, initStargateClient } from './client';
import { TRX_FEE_OPTION, TRX_MSG } from 'types/transactions';
import { USER } from 'types/user';
import { KEPLR_CHAIN_INFO_TYPE } from 'types/chain';

export const getKeplr = (): Keplr | undefined => {
  if (typeof window !== 'undefined' && window.keplr) return window.keplr;
  return undefined;
};

export const initializeKeplr = async (chainInfo: KEPLR_CHAIN_INFO_TYPE): Promise<USER | undefined> => {
  try {
    const keplr = getKeplr();
    await keplr?.experimentalSuggestChain(chainInfo as ChainInfo);
    await keplr?.enable(chainInfo.chainId);
    const key = await keplr?.getKey(chainInfo.chainId);
    return key
      ? { name: key.name, pubKey: key.pubKey, address: key.bech32Address, algo: key.algo, ledgered: true }
      : undefined;
  } catch (error) {
    console.error('initializeKeplr:: ' + error);
    return;
  }
};

export const connectKeplrAccount = async (chainInfo: KEPLR_CHAIN_INFO_TYPE): Promise<any> => {
  const keplr = getKeplr();
  if (!keplr) return [null, null];
  await keplr.experimentalSuggestChain(chainInfo as ChainInfo);
  await keplr.enable(chainInfo.chainId);
  const offlineSigner = keplr.getOfflineSigner(chainInfo.chainId);
  const accounts = await offlineSigner.getAccounts();
  return [accounts, offlineSigner];
};

export const keplrBroadCastMessage = async (
  msgs: TRX_MSG[],
  memo = '',
  fee: TRX_FEE_OPTION,
  feeDenom: string,
  chainInfo: KEPLR_CHAIN_INFO_TYPE,
): Promise<string | null> => {
  try {
    const [accounts, offlineSigner] = await connectKeplrAccount(chainInfo);

    if (!accounts) throw new Error('No accounts found to broadcast transaction');
    if (!offlineSigner) throw new Error('No offlineSigner found to broadcast transaction');

    const address = accounts[0].address;
    const client = await initStargateClient(chainInfo.rpc, offlineSigner);
    const payload = {
      msgs,
      chain_id: chainInfo.chainId,
      fee,
      feeDenom,
      memo,
    };
    const result = await sendTransaction(client, address, payload);

    if (!result) throw new Error('Transaction Failed');

    return result.transactionHash;
  } catch (e) {
    Toast.errorToast(`Transaction Failed`);
    return null;
  }
};
