import { getOpera as getJamboOpera } from '@ixo/jambo-wallet-sdk';
import { ChainInfo } from '@keplr-wallet/types';

import * as Toast from '@components/Toast/Toast';
import { sendTransaction, initStargateClient } from './client';
import { TRX_FEE_OPTION, TRX_MSG } from 'types/transactions';
import { USER } from 'types/user';

export const getOpera = getJamboOpera;

export const initializeOpera = async (chainInfo: ChainInfo): Promise<USER | undefined> => {
  const opera = getOpera();
  if (!opera) return;
  try {
    await opera.experimentalSuggestChain(chainInfo as ChainInfo);
    await opera.enable(chainInfo.chainId);
    const key = await opera.getKey(chainInfo.chainId);
    return key
      ? { name: key.name, pubKey: key.pubKey, address: key.bech32Address, algo: key.algo, ledgered: true }
      : undefined;
  } catch (error) {
    console.error('Error initializing Opera:: ' + error);
  }
};

export const connectOperaAccount = async (chainInfo: ChainInfo): Promise<any> => {
  const opera = getOpera();
  if (!opera) return [null, null];
  const offlineSigner = await opera.getOfflineSigner(chainInfo.chainId);
  if (!offlineSigner) return [null, null];
  const accounts = await offlineSigner.getAccounts();
  return [accounts, offlineSigner];
};

const trx_fail = () => {
  Toast.errorToast(`Transaction Failed`);
  return null;
};

export const operaBroadCastMessage = async (
  msgs: TRX_MSG[],
  memo = '',
  fee: TRX_FEE_OPTION,
  feeDenom: string,
  chainInfo: ChainInfo,
): Promise<string | null> => {
  const [accounts, offlineSigner] = await connectOperaAccount(chainInfo);
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
      return result.transactionHash;
    } else {
      throw 'transaction failed';
    }
  } catch (e) {
    return trx_fail();
  }
};
