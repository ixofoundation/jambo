import { AccountData, Algo, DirectSignResponse, OfflineDirectSigner } from '@cosmjs/proto-signing';
import { SignDoc } from '@ixo/impactxclient-sdk/types/codegen/cosmos/tx/v1beta1/tx';
import SignClient from '@walletconnect/sign-client';
import { SessionTypes } from '@walletconnect/types';
import { getSdkError } from '@walletconnect/utils';
import { Web3Modal } from '@web3modal/standalone';
import { ChainInfo } from '@keplr-wallet/types';
import { fromHex } from '@cosmjs/encoding';

import * as Toast from '@components/Toast/Toast';
import { sendTransaction, initStargateClient } from './client';
import { TRX_FEE_OPTION, TRX_MSG } from 'types/transactions';
import { USER } from 'types/user';
import { WalletConnectProjectId } from '@constants/wallet';
import { EVENT_LISTENER_TYPE } from '@constants/events';
import config from '@constants/config.json';
import { stringifySignDoc } from './encoding';
import { KEPLR_CHAIN_INFO_TYPE } from 'types/chain';

let signClient: SignClient;
export let address: string;
export let pubkeyByteArray: Uint8Array;
let web3Modal: Web3Modal;
let web3ModalSubscription: undefined | (() => void);

export enum WC_METHODS {
  signDirect = 'cosmos_signDirect',
  getAccounts = 'cosmos_getAccounts',
}

export const getWalletConnect = () => !!WalletConnectProjectId;

const getCurrentSession = () => {
  const sessions = signClient?.session?.getAll();
  if (!sessions.length) throw new Error('No current sessions');
  return sessions[0];
};

const deleteSession = () => {
  const event = new Event(EVENT_LISTENER_TYPE.wc_sessiondelete);
  window.dispatchEvent(event);

  // clear wc sessions and pairings
  (signClient.session.getAll() ?? []).forEach((session) =>
    signClient.session.delete(session.topic, getSdkError('USER_DISCONNECTED')),
  );
  (signClient.pairing.getAll() ?? []).forEach((pairing) =>
    signClient.pairing.delete(pairing.topic, getSdkError('USER_DISCONNECTED')),
  );

  // clear web3modal subscription in case still active
  if (web3ModalSubscription) web3ModalSubscription();
};

export const initializeWC = async (chainInfo: KEPLR_CHAIN_INFO_TYPE): Promise<USER | undefined> => {
  console.log('initializeWC');
  try {
    if (!getWalletConnect()) throw new Error('WalletConnect cannot initialize without a project id');

    web3Modal = new Web3Modal({
      projectId: WalletConnectProjectId!,
      walletConnectVersion: 2,
    });

    if (!web3Modal) throw new Error('Web3Modal is not initialized');
    if (!signClient)
      signClient = await SignClient.init({
        // logger: 'debug',
        // relayUrl: process.env.NEXT_PUBLIC_WC_RELAY_URL,
        projectId: WalletConnectProjectId,
        metadata: {
          name: config.siteName ?? 'JAMBO dApp',
          description: config.siteDescriptionMeta ?? 'JAMBO dApp with WalletConnect',
          url: config.siteUrl ?? 'https://my.jambo.earth/',
          icons: [
            config?.siteUrl
              ? `${config.siteUrl}/images/logo.png`
              : 'https://gblobscdn.gitbook.com/spaces%2F-LJJeCjcLrr53DcT1Ml7%2Favatar.png?alt=media',
          ],
        },
      });
    if (typeof signClient === 'undefined') throw new Error('WalletConnect is not initialized');

    signClient.on('session_event', (p) => {
      const event = new Event(EVENT_LISTENER_TYPE.wc_sessionevent);
      window.dispatchEvent(event);
    });
    signClient.on('session_update', ({ topic, params }) => {
      const event = new Event(EVENT_LISTENER_TYPE.wc_sessionupdate);
      window.dispatchEvent(event);
    });
    signClient.once('session_delete', deleteSession);

    let _session: SessionTypes.Struct;

    const sessions = signClient.session.getAll();

    if (sessions.length) {
      const curSession = sessions[0];
      const curSessionNamespace = Object.keys(curSession?.namespaces)?.[0];
      const curSessionChain = curSession?.namespaces?.[curSessionNamespace]?.chains?.[0];
      const curSessionMatchesChain = curSessionChain?.includes(chainInfo.chainId);
      if (!curSessionMatchesChain) {
        signClient.session.delete(curSession.topic, getSdkError('USER_DISCONNECTED'));
        (signClient.session.getAll() ?? []).forEach((session) =>
          signClient.session.delete(session.topic, getSdkError('USER_DISCONNECTED')),
        );
        (signClient.pairing.getAll() ?? []).forEach((pairing) =>
          signClient.pairing.delete(pairing.topic, getSdkError('USER_DISCONNECTED')),
        );
      } else {
        const account = await onSessionConnected(curSession);
        return account;
      }
    }

    const namespaces = {
      ixo: {
        methods: Object.values(WC_METHODS),
        chains: [`${chainInfo.chainName}:${chainInfo.chainId}`],
        events: [],
      },
    };
    const { uri, approval } = await signClient.connect({
      // Optionally: pass a known prior pairing (e.g. from `signClient.core.pairing.getPairings()`) to skip the `uri` step.
      // pairingTopic: pairing?.topic,

      requiredNamespaces: namespaces,
    });

    // Open QRCode modal if a URI was returned (i.e. we're not connecting an existing pairing).
    if (!uri) throw new Error('Failed to connect via WalletConnect');

    web3ModalSubscription = web3Modal.subscribeModal(({ open }) => {
      console.log('web3Modal.subscribeModal::', open);
      if (!open)
        setTimeout(() => {
          console.log('web3ModalSubscription::', !!_session);
          if (!_session) deleteSession();
        }, 1500);
    });

    await web3Modal.openModal({
      uri,
      standaloneChains: namespaces.ixo.chains,
    });
    // Await session approval from the wallet.
    _session = await approval();

    if (!_session) throw new Error('WalletConnect connection rejected');

    const account = await onSessionConnected(_session);
    return account;
  } catch (e) {
    console.error('walletConnect::initializeWC::', e);
    deleteSession();
  } finally {
    // clear web3modal subscription in case still active
    if (web3ModalSubscription) web3ModalSubscription();
    // Close the QRCode modal in case it was open.
    web3Modal.closeModal();
  }
};

const onSessionConnected = async (session: SessionTypes.Struct): Promise<USER | undefined> => {
  try {
    const accounts = await getAccounts();
    if (!accounts.length) return undefined;
    const account = accounts[0];
    return { name: 'WalletConnect', pubKey: account.pubkey, address: account.address, algo: account.algo };
  } catch (error) {
    console.error('walletConnect::onSessionConnected::', error);
  }
  return undefined;
};

export const getAccounts = async (): Promise<readonly AccountData[]> => {
  try {
    const _session = getCurrentSession();
    const curSessionNamespace = Object.values(_session?.namespaces)?.[0];
    const namespaceAccount = curSessionNamespace.accounts[0];
    const [namespace, chainId, address] = namespaceAccount.split(':');
    const chain = `${namespace}:${chainId}`;

    const accounts = await signClient.request<
      {
        address: string;
        algo: Algo;
        // pubkey from wallet connect is hex encoded, must od decoding to byte array self
        pubkey: string;
      }[]
    >({
      topic: _session.topic,
      chainId: chain,
      request: {
        method: WC_METHODS.getAccounts,
        params: undefined,
      },
    });

    return accounts.map((a) => ({ ...a, pubkey: fromHex(a.pubkey) }));
  } catch (error) {
    console.error('walletConnect::getAccounts::', error);
    return [];
  }
};

export const signDirect = async (signerAddress: string, signDoc: SignDoc): Promise<DirectSignResponse> => {
  try {
    const _session = getCurrentSession();
    const namespaceAccount = Object.values(_session.namespaces)?.[0]?.accounts?.[0];
    const [namespace, reference, address] = namespaceAccount.split(':');
    const chainId = `${namespace}:${reference}`;
    const result = await signClient.request<{ signature: string; pub_key: { type: string; value: string } }>({
      topic: _session!.topic,
      chainId,
      request: {
        method: WC_METHODS.signDirect,
        params: { signerAddress, signDoc: stringifySignDoc(signDoc) },
      },
    });

    if (!result.signature) throw new Error('Failed to sign transaction with WalletConnect');

    return {
      signed: signDoc,
      signature: result,
    };
  } catch (error) {
    console.error('walletConnect::signDirect::', error);
    throw error;
  }
};

export const getOfflineSigner = (): OfflineDirectSigner => {
  const offlineSigner: OfflineDirectSigner = { getAccounts, signDirect };
  return offlineSigner;
};

export const connectWalletConnectAccount = async (chainInfo: KEPLR_CHAIN_INFO_TYPE): Promise<any> => {
  const walletConnect = getWalletConnect();
  if (!walletConnect) return [null, null];
  const offlineSigner = getOfflineSigner();
  const accounts = await getAccounts();
  return [accounts, offlineSigner];
};

export const WCBroadCastMessage = async (
  msgs: TRX_MSG[],
  memo = '',
  fee: TRX_FEE_OPTION,
  feeDenom: string,
  chainInfo: KEPLR_CHAIN_INFO_TYPE,
): Promise<string | null> => {
  try {
    const [accounts, offlineSigner] = await connectWalletConnectAccount(chainInfo);

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
