import { AccountData, DirectSignResponse, OfflineDirectSigner } from '@cosmjs/proto-signing';
import { SignDoc } from '@ixo/impactxclient-sdk/types/codegen/cosmos/tx/v1beta1/tx';
import QRCodeModal from '@walletconnect/qrcode-modal';
import SignClient from '@walletconnect/sign-client';
import { SessionTypes } from '@walletconnect/types';
import { ChainInfo } from '@keplr-wallet/types';
import * as amino from '@cosmjs/amino';

import * as Toast from '@components/Toast/Toast';
import { sendTransaction, initStargateClient } from './client';
import { TRX_FEE_OPTION, TRX_MSG } from 'types/transactions';
import { USER } from 'types/user';
import { uint8Arr_to_b64 } from './encoding';
import config from '@constants/config.json';

let signClient: SignClient;
export let address: string;
export let pubkeyByteArray: Uint8Array;

export enum WC_METHODS {
  signDirect = 'cosmos_signDirect',
  getAccounts = 'cosmos_getAccounts',
}

const getCurrentSession = () => {
  if (!signClient?.session?.length) throw new Error('No current sessions');
  return signClient.session.get(signClient.session.keys[signClient.session.keys.length - 1]);
};

export const initializeWC = async (chainInfo: ChainInfo): Promise<USER | undefined> => {
  console.log('initializeWC');

  if (!signClient) {
    signClient = await SignClient.init({
      // logger: 'debug',
      // relayUrl: process.env.NEXT_PUBLIC_WC_RELAY_URL,
      projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID,
      metadata: {
        name: 'Ixo',
        description: 'Ixo Wallet Connect',
        url: 'https://ixo.world',
        icons: ['https://gblobscdn.gitbook.com/spaces%2F-LJJeCjcLrr53DcT1Ml7%2Favatar.png?alt=media'],
      },
    });
  }

  const createEffects = () => {
    if (typeof signClient === 'undefined') {
      throw new Error('WalletConnect is not initialized');
    }
    signClient.on('session_event', (p) => {
      console.log('EVENT', 'session_event', p);
    });

    signClient.on('session_update', ({ topic, params }) => {
      console.log('EVENT', 'session_update', { topic, params });
      // const { accounts, chainId } = payload.params[0];
      // updateWallet({ accounts, chainId });
    });

    signClient.on('session_delete', () => {
      console.log('EVENT', 'session_delete');
      // 	connector.killSession();
    });
  };
  createEffects();

  console.log('pairings: ' + signClient.pairing.getAll({ active: true }));
  console.log('session keys: ' + signClient.session.keys);

  let _session: SessionTypes.Struct;

  if (signClient.session.length) {
    return await onSessionConnected();
  }

  try {
    const { uri, approval } = await signClient.connect({
      // Optionally: pass a known prior pairing (e.g. from `signClient.core.pairing.getPairings()`) to skip the `uri` step.
      // pairingTopic: pairing?.topic,

      requiredNamespaces: {
        ixo: {
          methods: Object.values(WC_METHODS),
          chains: [`${config.wcNamespace}:${chainInfo.chainId}`],
          events: [],
        },
      },
    });

    // Open QRCode modal if a URI was returned (i.e. we're not connecting an existing pairing).
    if (uri) {
      QRCodeModal.open(uri, () => {
        console.log('EVENT', 'QR Code Modal closed');
      });
    }

    // Await session approval from the wallet.
    _session = await approval();
    // Handle the returned session (e.g. update UI to "connected" state).
    console.log({ _session });
  } catch (e) {
    console.error(e);
  } finally {
    // Close the QRCode modal in case it was open.
    QRCodeModal.close();
  }
  // @ts-ignore
  return _session ? await onSessionConnected() : undefined;
};

const onSessionConnected = async (): Promise<USER | undefined> => {
  try {
    const accounts = await getAccounts();
    if (accounts.length) {
      address = accounts[0].address;
      // pubkeyByteArray = b64_to_uint8Arr(uint8Arr_to_b64(Object.values(accounts[0].pubkey) as any));
      // console.log({ pubkeyByteArray });
      return { pubKey: pubkeyByteArray, address, algo: accounts[0].algo };
    }
  } catch (error) {
    console.log('Error getAccounts: ', error);
  }
  return undefined;
};

export const getAccounts = async (): Promise<readonly AccountData[]> => {
  const _session = getCurrentSession();
  // console.log('session namespaces: ' + _session.namespaces);
  const namespaceAccount = _session.namespaces[config.wcNamespace].accounts[0];
  const [namespace, reference, address] = namespaceAccount.split(':');
  const chainId = `${namespace}:${reference}`;

  try {
    const accounts = await signClient.request<AccountData[]>({
      topic: _session.topic,
      chainId,
      request: {
        method: WC_METHODS.getAccounts,
        params: undefined,
      },
    });
    console.log({ accounts });
    return accounts;
  } catch (error) {
    console.log('Error getAccounts: ', error);
  }
  return [];
};

export const signDirect = async (signerAddress: string, signDoc: SignDoc): Promise<DirectSignResponse> => {
  // const signature = await opera!.signMessage(hexValue, 'secp256k1', 0);
  // const transformedSignature = transformSignature(signature ?? '');
  // if (!signature || !transformedSignature) throw new Error('No signature, signing failed');

  const _session = getCurrentSession();
  // console.log('session namespaces: ' + _session.namespaces);
  const namespaceAccount = _session.namespaces[config.wcNamespace].accounts[0];
  const [namespace, reference, address] = namespaceAccount.split(':');
  const chainId = `${namespace}:${reference}`;
  let result: { signature: string };
  try {
    result = await signClient.request<typeof result>({
      topic: _session!.topic,
      chainId,
      request: {
        method: WC_METHODS.signDirect,
        params: { signerAddress, signDoc },
      },
    });
    if (!result.signature) throw new Error();
  } catch (error) {
    console.log('Error signDirect: ', error);
    throw new Error('Error signDirect: ');
  }

  // console.log({
  // 	signed: signDoc,
  // 	signature: {
  // 		pub_key: {
  // 			type: amino.pubkeyType.secp256k1,
  // 			value: uint8Arr_to_b64(pubkeyByteArray),
  // 		},
  // 		signature: result.signature,
  // 	},
  // });

  return {
    signed: signDoc,
    signature: {
      pub_key: {
        type: amino.pubkeyType.secp256k1,
        value: uint8Arr_to_b64(pubkeyByteArray),
      },
      signature: result.signature,
    },
  };
};

export const getOfflineSigner = (): OfflineDirectSigner => {
  const offlineSigner: OfflineDirectSigner = { getAccounts, signDirect };
  return offlineSigner;
};

const trx_fail = () => {
  Toast.errorToast(`Transaction Failed`);
  return null;
};

export const WCBroadCastMessage = async (
  msgs: TRX_MSG[],
  memo = '',
  fee: TRX_FEE_OPTION,
  feeDenom: string,
  chainInfo: ChainInfo,
): Promise<string | null> => {
  // @ts-ignore
  const offlineSigner = getOfflineSigner();
  if (!address || !offlineSigner) return trx_fail();
  // const client = await initStargateClient(offlineSigner, 'https://impacthub.ixo.world/rpc/');
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
