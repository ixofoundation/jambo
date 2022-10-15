import { BLOCKCHAIN_REST_URL, CHAIN_ID } from '@constants/chains';
import axios from 'axios';
import { DirectSignResponse, OfflineDirectSigner, AccountData, OfflineSigner } from '@cosmjs/proto-signing';
import { SigningStargateClient } from '@client-sdk/utils/customClient';

import { toBech32, toBase64, fromBase64 } from '@cosmjs/encoding';
import { OfflineSigner as OfflineAminoSigner, AminoSignResponse, StdSignDoc } from '@cosmjs/launchpad';
import { serializeSignDoc, pubkeyType } from '@cosmjs/amino';

import { TRX_FEE, TRX_MSG } from 'types/transactions';
import { USER } from 'types/user';
import { WALLET } from 'types/wallet';
// import blocksyncApi from './blocksync';
import * as Toast from '@components/toast/toast';
import { initStargateClient, sendTransaction } from './client';
import { accountFromAny } from '@client-sdk/utils/EdAccountHandler';

export const getKeysafe = async (): Promise<any> => {
	if (typeof window !== 'undefined' && window['ixoKs']) {
		const IxoInpageProvider = window['ixoKs'];
		const ixoInpageProvider = new IxoInpageProvider();

		if (ixoInpageProvider) {
			const getAccounts = async (): Promise<readonly AccountData[]> => {
				return await new Promise<readonly AccountData[]>(resolve => {
					ixoInpageProvider.getInfo(async (error: any, response: any) => {
						// console.log({ response });
						if (response) {
							try {
								const addressResponse = await axios.get(`${BLOCKCHAIN_REST_URL}/pubKeyToAddr/${response.didDoc.pubKey}`);
								// console.log({ addressResponse });
								const address = addressResponse.data.result;

								const accountResponse = await axios.get(`${BLOCKCHAIN_REST_URL}/auth/accounts/${address}`);
								// console.log({ accountResponse });

								resolve([{ address, algo: 'ed25519', pubkey: fromBase64(response.didDoc.pubKey) }]);
							} catch (error) {
								resolve([]);
								console.log('Error blocksyncApi.user.getDidDoc: ' + error);
							}
						}
						resolve([]);
					});
				});
			};

			const signAmino = async (signerAddress: string, signDoc: StdSignDoc): Promise<AminoSignResponse> => {
				const account = (await getAccounts()).find(({ address }) => address === signerAddress);
				if (!account) throw new Error(`Address ${signerAddress} not found in wallet`);
				// console.log({ account, signerAddress });

				const signature = await new Promise<Uint8Array | null>(resolve => {
					ixoInpageProvider.requestSigning(
						JSON.stringify(signDoc),
						(error: any, signature: any) => {
							if (error || !signature) resolve(null);
							resolve(fromBase64(signature.signatureValue));
						},
						'base64',
					);
				});
				if (!signature) throw new Error('No signature, signing failed');
				// console.log('signature length: ' + signature.length);
				const stdSignature = encodeEd25519Signature(account.pubkey, signature.slice(0, 64));
				// console.log({ signature });

				return { signed: signDoc, signature: stdSignature };
			};

			const offlineSigner: OfflineAminoSigner = { getAccounts, signAmino };
			// const offlineSigner: OfflineDirectSigner = { getAccounts, signDirect };
			ixoInpageProvider.offlineSigner = offlineSigner;
		}

		if (ixoInpageProvider) return ixoInpageProvider;
	}

	return undefined;
};

function encodeEd25519Signature(pubkey: Uint8Array, signature: Uint8Array): any {
	if (signature.length !== 64) throw new Error('Signature must be 64 bytes long. Cosmos SDK uses a 2x32 byte fixed length encoding for the Ed25519 signature integers r and s.');

	return {
		pub_key: {
			type: pubkeyType.ed25519,
			value: toBase64(pubkey),
		},
		signature: toBase64(signature),
	};
}

export const initializeKeysafe = async (wallet?: WALLET): Promise<USER | undefined> => {
	const keysafe = await getKeysafe();
	const user = await new Promise<USER | undefined>(resolve => {
		keysafe.getInfo(async (error: any, response: any) => {
			if (response) {
				// console.log({ response });
				let baseUser = { name: response.name, pubKey: response.didDoc.pubKey, address: '', didDoc: response.didDoc, ledgered: false };

				try {
					// const getDidDoc = await blocksyncApi.user.getDidDoc(response.didDoc.did);
					// console.log({ getDidDoc });
					// if (!(getDidDoc as any)?.error) baseUser.ledgered = true;

					// if (wallet.user?.pubKey !== baseUser.pubKey || wallet.user?.ledgered !== baseUser.ledgered || wallet.user?.accountNumber == undefined || wallet.user?.address == undefined) {
					const addressResponse = await axios.get(`${BLOCKCHAIN_REST_URL}/pubKeyToAddr/${response.didDoc.pubKey}`);
					// console.log({ addressResponse });
					const address = addressResponse.data.result;

					const accountResponse = await axios.get(`${BLOCKCHAIN_REST_URL}/auth/accounts/${address}`);
					// console.log({ accountResponse });

					let account = accountResponse.data.result.value;
					resolve({ ...baseUser, address: account.address, sequence: account.sequence, accountNumber: account.account_number ?? account.accountNumber });
					// }
					resolve(wallet?.user);
				} catch (error) {
					console.log('Error blocksyncApi.user.getDidDoc: ' + error);
				}
			}
			resolve(undefined);
		});
	});
	return user;
};

export const keysafeBroadCastMessage = async (user: USER, msgs: TRX_MSG[], memo = '', fee: TRX_FEE): Promise<string | null> => {
	const trx_fail = () => {
		Toast.errorToast(`Transaction Failed`);
		return null;
	};

	const keysafe = await getKeysafe();

	// const [accounts, offlineSigner] = await connectKeplrAccount();
	// if (!accounts || !offlineSigner) return trx_fail();
	// const address = accounts[0].address;
	const client = await initStargateClient(keysafe.offlineSigner);
	// const client = await initCustomStargateClient(keysafe.offlineSigner);

	const payload = {
		msgs,
		chain_id: CHAIN_ID,
		fee,
		memo,
	};

	try {
		const result = await sendTransaction(client, user.address, payload);
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

const getKeysafeDidDoc = async (): Promise<any> => {
	return new Promise(resolve => {
		initKeysafe().getInfo((error: any, response: any) => {
			if (!error && response) {
				const { didDoc } = response;
				resolve(didDoc);
			} else {
				resolve(undefined);
			}
		});
	});
};
const createSignature = async (payload: any): Promise<Uint8Array> => {
	return new Promise(resolve => {
		initKeysafe().requestSigning(
			JSON.stringify(payload),
			async (error: any, signature: any) => {
				if (error || !signature) {
					resolve(new Uint8Array());
				} else {
					resolve(fromBase64(signature.signatureValue));
				}
			},
			'base64',
		);
	});
};

function encodeEd25519Pubkey(pubkey: any): any {
	return {
		type: pubkeyType.ed25519,
		value: toBase64(pubkey),
	};
}

function encodeEd25519Signature1(pubkey: any, signature: any): any {
	if (signature.length !== 64) {
		throw new Error('Signature must be 64 bytes long. Cosmos SDK uses a 2x32 byte fixed length encoding for the Ed25519 signature integers r and s.');
	}
	return {
		pub_key: encodeEd25519Pubkey(pubkey),
		signature: toBase64(signature),
	};
}

import { Registry } from '@cosmjs/proto-signing';
import { defaultRegistryTypes as defaultStargateTypes } from '@cosmjs/stargate';
import { Coin } from '@client-sdk/codec/cosmos/coin';
import { SignDoc } from '@client-sdk/codec/external/cosmos/tx/v1beta1/tx';
import { MsgSend } from 'cosmjs-types/cosmos/bank/v1beta1/tx';

export const messageSend = async (signer: any, fromAddress: string, msgs: any, fee: any): Promise<void> => {
	const myRegistry = new Registry(defaultStargateTypes);
	myRegistry.register('/cosmos.bank.v1beta1.MsgSend', MsgSend);

	const client = await SigningStargateClient.connectWithSigner('https://testnet.ixo.earth/rpc/', signer, {
		registry: myRegistry,
		accountParser: accountFromAny,
	});

	const response = await client.signAndBroadcast(fromAddress, msgs, fee);
	console.log({ response });
	// return response;
};

export const messageSendKeysafe = async (fromAddress: string, msgs: any, fee: any): Promise<void> => {
	const { pubKey } = await getKeysafeDidDoc();
	const getAccounts = (): Promise<AccountData[]> => {
		return new Promise(resolve => {
			resolve([
				{
					address: fromAddress,
					algo: 'ed25519',
					pubkey: fromBase64(pubKey),
				},
			]);
		});
	};
	const signDirect = async (address: string, signDoc: SignDoc): Promise<DirectSignResponse> => {
		const signature = await createSignature(msgs);

		const signatureBytes = new Uint8Array(signature.slice(0, 64));
		const stdSignature = encodeEd25519Signature1(pubKey, signatureBytes);
		return {
			signed: signDoc,
			signature: stdSignature,
		};
	};

	const offlineSigner: OfflineSigner = {
		getAccounts,
		signDirect,
	};

	await messageSend(offlineSigner, fromAddress, msgs, fee);
};

const initKeysafe = (): any => {
	let keysafe;

	if (!window['ixoKs']) {
		keysafe = null;
	} else {
		const IxoInpageProvider = window['ixoKs'];
		const ixoInpageProvider = new IxoInpageProvider();

		if (ixoInpageProvider) {
			keysafe = ixoInpageProvider;
		} else {
			keysafe = null;
		}
	}

	return keysafe;
};
