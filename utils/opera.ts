import { getOpera as getJamboOpera } from '@ixo/jambo-wallet-sdk';
import { ChainInfo } from '@keplr-wallet/types';

import * as Toast from '@components/Toast/Toast';
import { sendTransaction, initStargateClient } from './client';
import { TRX_FEE_OPTION, TRX_MSG } from 'types/transactions';
import { USER } from 'types/user';
import { KEPLR_CHAIN_INFO_TYPE } from 'types/chain';

export const getOpera = getJamboOpera;

export const initializeOpera = async (chainInfo: KEPLR_CHAIN_INFO_TYPE): Promise<USER | undefined> => {
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

export const connectOperaAccount = async (chainInfo: KEPLR_CHAIN_INFO_TYPE): Promise<any> => {
  const opera = getOpera();
  if (!opera) return [null, null];
  const offlineSigner = await opera.getOfflineSigner(chainInfo.chainId);
  if (!offlineSigner) return [null, null];
  const accounts = await offlineSigner.getAccounts();
  return [accounts, offlineSigner];
};

export const operaBroadCastMessage = async (
  msgs: TRX_MSG[],
  memo = '',
  fee: TRX_FEE_OPTION,
  feeDenom: string,
  chainInfo: KEPLR_CHAIN_INFO_TYPE,
): Promise<string | null> => {
  try {
    const [accounts, offlineSigner] = await connectOperaAccount(chainInfo);

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
