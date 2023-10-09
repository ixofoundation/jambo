import { ChainInfo, Keplr } from '@keplr-wallet/types';

import * as Toast from '@components/Toast/Toast';
import { sendTransaction, initStargateClient } from './client';
import { TRX_FEE_OPTION, TRX_MSG } from 'types/transactions';
import { USER } from 'types/user';
import GranterAddress from '@components/UserWallets/GranterAddress';

export const getKeplr = (): Keplr | undefined => {
  if (typeof window !== 'undefined' && window.keplr) return window.keplr;
  return undefined;
};

export const initializeKeplr = async (chainInfo: ChainInfo): Promise<USER | undefined> => {
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

export const connectKeplrAccount = async (chainInfo: ChainInfo): Promise<any> => {
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
  chainInfo: ChainInfo,
): Promise<string | null> => {
  try {
    const granter = await GranterAddress();
    if (!granter) throw new Error('Granter address not available');

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


    // const granter = `${granterAddress}`;
    // const granter = granterAddress;
    // const granter = grant?.toString()
    // const granter = await GranterAddress();
    // const granterAddress = 'ixo1vafr2dqhgz8frc7gf22njz8y2u0fue4kuetey6'
    // const granter = granterAddress;
    const result = await sendTransaction(client, address, payload, granter);

    if (!result) throw new Error('Transaction Failed');

    return result.transactionHash;
  } catch (e) {
    Toast.errorToast(`Transaction Failed`);
    return null;
  }
};
