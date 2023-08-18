import { getImpactsX as getJamboImpactsX } from '@ixo/jambo-wallet-sdk';
import { ChainInfo } from '@keplr-wallet/types';

import * as Toast from '@components/Toast/Toast';
import { sendTransaction, initStargateClient } from './client';
import { TRX_FEE_OPTION, TRX_MSG } from 'types/transactions';
import { USER } from 'types/user';

export const getImpactsX = getJamboImpactsX;

export const initializeImpactsX = async (chainInfo: ChainInfo): Promise<USER | undefined> => {
  const impactsX = getImpactsX();
  if (!impactsX) return;
  try {
    // await impactsX.experimentalSuggestChain(chainInfo as ChainInfo);
    await impactsX.enable(chainInfo.chainId, 'testnet');
    const key = await impactsX.getKey(chainInfo.chainId);
    return key
      ? { name: key.name, pubKey: key.pubKey, address: key.bech32Address, algo: key.algo, ledgered: true }
      : undefined;
  } catch (error) {
    console.error('Error initializing impactsX:: ' + error);
  }
};

export const connectImpactsXAccount = async (chainInfo: ChainInfo): Promise<any> => {
  const impactsX = getImpactsX();
  if (!impactsX) return [null, null];
  const offlineSigner = impactsX.getOfflineSigner(chainInfo.chainId);
  if (!offlineSigner) return [null, null];
  const accounts = await offlineSigner.getAccounts();
  return [accounts, offlineSigner];
};

export const impactsXBroadCastMessage = async (
  msgs: TRX_MSG[],
  memo = '',
  fee: TRX_FEE_OPTION,
  feeDenom: string,
  chainInfo: ChainInfo,
): Promise<string | null> => {
  try {
    const [accounts, offlineSigner] = await connectImpactsXAccount(chainInfo);

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

    if (!result) throw new Error('Transaction Failed - ' + JSON.stringify(result));

    return result.transactionHash;
  } catch (e) {
    Toast.errorToast(`Transaction Failed ${(e as Error).message}`);
    return null;
  }
};
