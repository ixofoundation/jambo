import WalletConnect from '@walletconnect/client';
import QRCodeModal from '@walletconnect/qrcode-modal';

import { CHAINS, CHAIN_ID } from '@constants/chains';
import { Keplr } from '@keplr-wallet/types';
import { USER } from 'types/user';
import { TRX_FEE, TRX_MSG } from 'types/transactions';
import * as Toast from '@components/toast/toast';
import { sendTransaction, initStargateClient } from './client';
import { KeplrWalletConnectV1 } from '@keplr-wallet/wc-client';

const createNewWallet = () => {
	const wc = new WalletConnect({
		bridge: 'https://bridge.walletconnect.org',
		qrcodeModal: QRCodeModal,
		signingMethods: ['keplr_enable_wallet_connect_v1', 'keplr_sign_amino_wallet_connect_v1'],
	});
	// console.log({ wc });

	// XXX: I don't know why they designed that the client meta options in the constructor should be always ingored...
	// @ts-ignore
	wc._clientMeta = {
		name: 'Ixo',
		description: 'Ixo would like to connect',
		url: 'https://ixo.world',
		icons: ['https://gblobscdn.gitbook.com/spaces%2F-LJJeCjcLrr53DcT1Ml7%2Favatar.png?alt=media'],
	};
	return wc;
};

let connector = createNewWallet();
let keplrWC: KeplrWalletConnectV1;

export const getKeplr = (): Keplr | undefined => {
	if (typeof window !== 'undefined' && window.keplr) return window.keplr;
	return undefined;
};

export const initializeWC = async (): Promise<USER | undefined> => {
	// const keplr = getKeplr();
	// try {
	// 	await keplr?.experimentalSuggestChain(CHAINS[CHAIN_ID]);
	// 	await keplr?.enable(CHAIN_ID);
	// 	const key = await keplr?.getKey(CHAIN_ID);
	// 	return key ? { name: key.name, pubKey: key.pubKey, address: key.bech32Address, algo: key.algo, ledgered: true } : undefined;
	// } catch (error) {
	// 	console.error('Error initializing Kepl: ' + error);
	// }
	// return;

	const createKeplrWC = async (): Promise<USER | undefined> => {
		// keplrWC = new KeplrWalletConnectV1(connector, {
		// 	sendTx: sendTxWC,
		// });
		try {
			keplrWC = new KeplrWalletConnectV1(connector);
			// keplrWC.signDirect();
			const key = await keplrWC.getKey('impacthub-3');
			console.log({ key });
			return key ? { name: key.name, pubKey: key.pubKey, address: key.bech32Address, algo: key.algo, ledgered: true } : undefined;
		} catch (error) {
			console.error('Error initializing WC Kepl: ' + error);
		}
		return;
		// keplrWC.sendTx('impacthub-3', fromBase64('asdasdas'), BroadcastMode.Block);
	};

	const createEffects = () => {
		connector.on('connect', (error, payload) => {
			console.log('connect !!!!!');
			// createKeplrWC();
			if (error) throw error;
			// const { accounts, chainId } = payload.params[0];
			// updateWallet({ accounts, chainId });
		});

		connector.on('session_update', (error, payload) => {
			console.log('session_update !!!!!!');
			if (error) throw error;
			// const { accounts, chainId } = payload.params[0];
			// updateWallet({ accounts, chainId });
		});

		connector.on('disconnect', (error, payload) => {
			console.log('disconnect !!!!!!');
			if (error) throw error;
			try {
				connector.killSession();
			} catch (error) {
				console.error(error);
			}
		});
	};

	console.log('initializeWC');
	if (connector.connected) {
		console.log('connected');
		createEffects();
		return await createKeplrWC();
		// connector.killSession();
		// await timeout(100);
	}
	connector = createNewWallet();
	console.log('createSession create');
	await connector.createSession();
	createEffects();
	return await createKeplrWC();
};

export const WCBroadCastMessage = async (user: USER, msgs: TRX_MSG[], memo = '', fee: TRX_FEE): Promise<string | null> => {
	const trx_fail = () => {
		Toast.errorToast(`Transaction Failed`);
		return null;
	};

	const offlineSigner = keplrWC.getOfflineSigner(CHAIN_ID);
	const address = user.address;
	if (!address || !offlineSigner) return trx_fail();
	// const client = await initStargateClient(offlineSigner, 'https://impacthub.ixo.world/rpc/');
	const client = await initStargateClient(offlineSigner);

	const payload = {
		msgs,
		chain_id: CHAIN_ID,
		fee,
		memo,
	};

	try {
		const result = await sendTransaction(client, address, payload);
		if (result) {
			Toast.successToast(`Transaction Successful`);
			return result.transactionHash;
		} else {
			throw 'transaction failed';
		}
	} catch (e) {
		return trx_fail();
	}
};
