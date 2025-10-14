import { fromHex, toHex } from '@cosmjs/encoding';
import { createRegistry } from '@ixo//impactxclient-sdk';
import {
  SignX,
  SIGN_X_LOGIN_ERROR,
  SIGN_X_LOGIN_SUCCESS,
  SIGN_X_TRANSACT_ERROR,
  SIGN_X_TRANSACT_SUCCESS,
  SIGN_X_DATA_ERROR,
  SIGN_X_DATA_SUCCESS,
} from '@ixo/signx-sdk';

import * as Toast from '@components/Toast/Toast';
import { TRX_FEE_OPTION, TRX_MSG } from '../types/transactions';
import { USER } from '../types/user';
import { WALLET } from '../types/wallet';
import { renderModal } from '@components/Modal/Modal';
import SignXModal from '@components/SignX/SignX';
import { EVENT_LISTENER_TYPE } from '../constants/events';
import { SIGN_X_RELAYERS } from '../constants/urls';

const NETWORK: any = process.env.NEXT_PUBLIC_CHAIN_NETWORK as any;

let signXClient: SignX;

let signXInitializing = false;
export const initializeSignX = async (
  network: 'mainnet' | 'testnet' | 'devnet',
  walletUser?: USER,
): Promise<USER | undefined> => {
  if (signXInitializing) return;
  signXInitializing = true;

  let removeModal: () => void;
  try {
    if (!network) throw new Error('No network found to initialize SignX');
    if (network !== NETWORK) throw new Error(`SignX only works on ${NETWORK}`);

    signXClient = new SignX({
      endpoint: SIGN_X_RELAYERS[NETWORK as 'devnet'],
      // endpoint: 'http://localhost:8000',
      network: NETWORK,
      sitename: 'https://test.matrix.jambo',
    });

    // if user already has an address or pubkey, return
    if (walletUser?.address || walletUser?.pubKey) return walletUser;

    // get login data from client to display QR code and start polling
    const data = await signXClient.login({ pollingInterval: 1000, matrix: true });

    // callback for when modal is closed manually
    const onManualCloseModal = () => {
      signXClient.stopPolling('Login cancelled', SIGN_X_LOGIN_ERROR);
    };

    removeModal = renderModal(
      // @ts-ignore
      <SignXModal title='SignX Login' data={data} timeout={signXClient.timeout} transactSequence={1} />,
      onManualCloseModal,
    );

    const eventData: any = await new Promise((resolve, reject) => {
      const handleSuccess = (data: any) => resolve(data);
      const handleError = (error: any) => reject(error);
      signXClient.on(SIGN_X_LOGIN_SUCCESS, handleSuccess);
      signXClient.on(SIGN_X_LOGIN_ERROR, handleError);
    });
    // removeModal();

    console.log({ eventData });

    return {
      name: eventData.data.name,
      address: eventData.data.address,
      pubKey: fromHex(eventData.data.pubKey),
      did: eventData.data.did,
      algo: eventData.data.algo,
      network: network,
      matrix: eventData.data.matrix,
    };
  } catch (e) {
    console.error('ERROR::initializeSignX::', e);
    const event = new Event(EVENT_LISTENER_TYPE.wallet_logout);
    window.dispatchEvent(event);
  } finally {
    signXInitializing = false;
    // @ts-ignore
    if (removeModal) removeModal();
    // remove event listeners
    signXClient.removeAllListeners(SIGN_X_LOGIN_ERROR);
    signXClient.removeAllListeners(SIGN_X_LOGIN_SUCCESS);
  }
};

let signXBroadCastMessageBusy = false;
export const signXBroadCastMessage = async (
  msgs: TRX_MSG[],
  memo = '',
  fee: TRX_FEE_OPTION,
  feeDenom: string,
  network: 'mainnet' | 'testnet' | 'devnet',
  wallet: WALLET,
): Promise<string | null> => {
  if (signXBroadCastMessageBusy) return null;
  signXBroadCastMessageBusy = true;

  let removeModal: () => void;
  // callback for when modal is closed manually
  let onManualCloseModal = (clearSession = true) => {
    signXClient.stopPolling('Transaction cancelled', SIGN_X_TRANSACT_ERROR, clearSession);
  };

  try {
    if (!network) throw new Error('No network found to broadcast transaction');
    if (network !== NETWORK) throw new Error(`SignX only works on ${NETWORK}`);

    if (!wallet.user) throw new Error('No user found to broadcast transaction');
    if (!signXClient) throw new Error('No signXClient found to broadcast transaction');

    const registry = createRegistry();
    const txBody = toHex(registry.encodeTxBody({ messages: msgs as any, memo }));

    // get transact data from client to start polling, display QR code if new session
    const data = await signXClient.transact({
      address: wallet.user.address,
      did: wallet.user.did!,
      pubkey: toHex(wallet.user.pubKey),
      timestamp: new Date().toISOString(),
      transactions: [{ sequence: 1, txBodyHex: txBody }],
    });

    // if already active session(aka no sessionHash), start polling for next transaction that was just added
    if (!data?.sessionHash) {
      signXClient.pollNextTransaction();
    }

    removeModal = renderModal(
      // @ts-ignore
      <SignXModal
        title='SignX Transaction'
        data={data}
        timeout={signXClient.timeout}
        transactSequence={signXClient.transactSequence}
      />,
      onManualCloseModal,
    );

    // wait for transaction to be broadcasted and SignX to emit success or fail event
    const eventData: any = await new Promise((resolve, reject) => {
      const handleSuccess = (data: any) => resolve(data);
      const handleError = (error: any) => reject(error);
      signXClient.on(SIGN_X_TRANSACT_SUCCESS, handleSuccess);
      signXClient.on(SIGN_X_TRANSACT_ERROR, handleError);
    });

    return eventData.data?.transactionHash;
  } catch (e) {
    console.error('ERROR::signXBroadCastMessage::', e);
    Toast.errorToast(`Transaction Failed`);
    return null;
  } finally {
    signXBroadCastMessageBusy = false;
    // @ts-ignore
    if (removeModal) removeModal();
    // @ts-ignore
    if (onManualCloseModal) onManualCloseModal(false);
    // remove event listeners
    signXClient.removeAllListeners(SIGN_X_TRANSACT_ERROR);
    signXClient.removeAllListeners(SIGN_X_TRANSACT_SUCCESS);
  }
};

let signXDDataPassBusy = false;
export const signXDataPass = async (jsonData: any, type: string): Promise<any> => {
  if (signXDDataPassBusy) return null;
  signXDDataPassBusy = true;

  let removeModal: () => void;
  // callback for when modal is closed manually
  let onManualCloseModal = (clearSession = true) => {
    signXClient.stopPolling('Data Pass cancelled', SIGN_X_DATA_ERROR, clearSession);
  };

  try {
    if (!signXClient) {
      signXClient = new SignX({
        endpoint: SIGN_X_RELAYERS[NETWORK as 'devnet'],
        // endpoint: 'http://localhost:8000',
        network: NETWORK,
        sitename: 'https://playground.matrix.org',
      });
    }

    // get data pass data from client to start polling and display QR code for key passing
    const data = await signXClient.dataPass({
      data: jsonData,
      type,
    });
    console.log({ data });

    removeModal = renderModal(
      // @ts-ignore
      <SignXModal title='SignX Data Pass' data={data} timeout={signXClient.timeout} transactSequence={1} />,
      onManualCloseModal,
    );

    // wait for data to be passed and handled and SignX to emit success or fail event
    const eventData: any = await new Promise((resolve, reject) => {
      const handleSuccess = (data: any) => resolve(data);
      const handleError = (error: any) => reject(error);
      signXClient.on(SIGN_X_DATA_SUCCESS, handleSuccess);
      signXClient.on(SIGN_X_DATA_ERROR, handleError);
    });

    return eventData;
  } catch (e: any) {
    console.error('ERROR::signXDataPass::', e);
    Toast.errorToast(`SignX Data Pass Failed: ${e.message}`);
    return null;
  } finally {
    signXDDataPassBusy = false;
    // @ts-ignore
    if (removeModal) removeModal();
    // @ts-ignore
    if (onManualCloseModal) onManualCloseModal(false);
    // remove event listeners
    signXClient.removeAllListeners(SIGN_X_DATA_ERROR);
    signXClient.removeAllListeners(SIGN_X_DATA_SUCCESS);
  }
};
