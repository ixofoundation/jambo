import { ChainInfo, Keplr } from '@keplr-wallet/types';

import * as Toast from '@components/Toast/Toast';
import { sendTransaction, initStargateClient } from './client';
import { TRX_FEE_OPTION, TRX_MSG } from 'types/transactions';
import { USER } from 'types/user';

export const getKeplr = (): Keplr | undefined => {
  if (typeof window !== 'undefined' && window.keplr) return window.keplr;
  return undefined;
};

export const initializeKeplr = async (chainInfo: ChainInfo): Promise<USER | undefined> => {
  const keplr = getKeplr();
  try {
    await keplr?.experimentalSuggestChain(chainInfo as ChainInfo);
    await keplr?.enable(chainInfo.chainId);
    const key = await keplr?.getKey(chainInfo.chainId);
    return key
      ? { name: key.name, pubKey: key.pubKey, address: key.bech32Address, algo: key.algo, ledgered: true }
      : undefined;
  } catch (error) {
    console.error('Error initializing Keplr:: ' + error);
  }
  return;
};

export const connectKeplrAccount = async (chainInfo: ChainInfo): Promise<any> => {
  const keplr = getKeplr();
  if (!keplr) return [null, null];
  await keplr.experimentalSuggestChain(chainInfo as ChainInfo);
  await keplr.enable(chainInfo.chainId);
  const offlineSigner = keplr.getOfflineSigner(chainInfo.chainId);
  const accounts = await offlineSigner.getAccounts();
  return [accounts, offlineSigner];
};

const trx_fail = () => {
  Toast.errorToast(`Transaction Failed`);
  return null;
};

export const keplrBroadCastMessage = async (
  msgs: TRX_MSG[],
  memo = '',
  fee: TRX_FEE_OPTION,
  feeDenom: string,
  chainInfo: ChainInfo,
): Promise<string | null> => {
  const [accounts, offlineSigner] = await connectKeplrAccount(chainInfo);
  if (!accounts || !offlineSigner) return trx_fail();
  const address = accounts[0].address;
  const client = await initStargateClient(chainInfo.rpc, offlineSigner);

  const payload = {
    msgs,
    chain_id: chainInfo.chainId,
    fee,
    feeDenom,
    memo,
  };

  try {
    const result = await sendTransaction(client, address, payload);
    if (result) {
      // Toast.successToast(`Transaction Successful`);
      return result.transactionHash;
    } else {
      throw 'transaction failed';
    }
  } catch (e) {
    return trx_fail();
  }
};
