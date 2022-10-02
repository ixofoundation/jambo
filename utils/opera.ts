import * as amino from '@cosmjs/amino';
import * as base58 from 'bs58';
import * as crypto from '@cosmjs/crypto';
import { b58_to_uint8Arr, uint8Arr_to_b64 } from './encoding';
import { USER } from 'types/user';
import blocksyncApi from './blocksync';

const addressIndex = 0;
const signMethod = 'secp256k1';
const pubKeyType = 'EcdsaSecp256k1VerificationKey2019';

interface InterchainWallet {
	getDidDoc: (index: number) => string;
	signMessage: (hexStdSignDoc: string, signMethod: string, addressIndex: string) => string;
}

export interface OperaInterchain {
	interchain?: InterchainWallet;
}

export const getOpera = (): InterchainWallet | undefined => {
	if (typeof window !== 'undefined' && window.interchain) return window.interchain;
	return undefined;
};

export const getDIDDocJSON = () => {
	const didDoc = getOpera()?.getDidDoc(0);
	const didDocJSON = JSON.parse(didDoc ?? '{}');
	return didDocJSON;
};

export const initializeOpera = async (): Promise<USER | undefined> => {
	let ledgered = false;
	const didDocJSON = getDIDDocJSON();

	try {
		const getDidDoc = await blocksyncApi.user.getDidDoc(didDocJSON.id);
		console.log({ getDidDoc });
		if (!(getDidDoc as any)?.error) ledgered = true;
	} catch (error) {}

	const verificationMethod = didDocJSON.verificationMethod.find((x: any) => x.type == pubKeyType);
	const pubkeyBase58 = verificationMethod.publicKeyBase58;
	const pubkeyByteArray = b58_to_uint8Arr(pubkeyBase58);
	const pubkeyBase64 = uint8Arr_to_b64(pubkeyByteArray);

	const pubkey = {
		type: amino.pubkeyType.secp256k1,
		value: pubkeyBase64,
	};
	const address = amino.pubkeyToAddress(pubkey, 'ixo');

	console.log('operaSECP256k1helper.didDocJSON', didDocJSON);
	console.log('operaSECP256k1helper.verificationMethod', verificationMethod);
	console.log('operaSECP256k1helper.pubkeyBase58', pubkeyBase58);
	console.log('operaSECP256k1helper.pubkeyByteArray', pubkeyByteArray);
	console.log('operaSECP256k1helper.pubkeyBase64', pubkeyBase64);
	console.log('operaSECP256k1helper.address', address);

	return { pubKey: pubkeyBase64, address, ledgered };
};

// export async function sign(stdSignDoc: amino.StdSignDoc, signMethod, addressIndex) {
// 	const sha256msg = crypto.sha256(amino.serializeSignDoc(stdSignDoc));
// 	const hexValue = Buffer.from(sha256msg).toString('hex');
// 	const signature = await window.interchain.signMessage(hexValue, signMethod, addressIndex);
// 	return signature;
// }

// export async function sign(stdSignDoc: amino.StdSignDoc) {
// 	let signature = await operahelper.sign(stdSignDoc, signMethod, addressIndex);
// 	signature = transformSignature(signature);
// 	return { signed: stdSignDoc, signature: signature };
// }

// /* With thanks to Benzhe of Opera!
//  */
// export function transformSignature(signature) {
// 	const rawArray = Base64.toUint8Array(signature);

// 	if (rawArray.length < 64 || rawArray.length > 66) {
// 		console.log('operahelper.invalid length');
// 		return;
// 	}

// 	let signatureCosmjsBase64 = '';

// 	if (rawArray.length == 64) {
// 		signatureCosmjsBase64 = signature;
// 	} else if (rawArray.length == 65) {
// 		if (rawArray[0] == 0x00) {
// 			signatureCosmjsBase64 = Base64.fromUint8Array(rawArray.slice(1, 65));
// 		} else if (rawArray[32] == 0x00) {
// 			signatureCosmjsBase64 = Base64.fromUint8Array([rawArray.slice(0, 32), rawArray.slice(33, 65)]);
// 		} else {
// 			console.log('operahelper.invalid signature array, length 65');
// 		}
// 	} else if (rawArray.length == 66) {
// 		if (rawArray[0] == 0x00 && rawArray[33] == 0x00) {
// 			signatureCosmjsBase64 = Base64.fromUint8Array([rawArray.slice(1, 33), rawArray.slice(34, 66)]);
// 		} else {
// 			console.log('operahelper.invalid signature array, length 66');
// 		}
// 	}
// 	console.log('operahelper.signatureCosmjsBase64', signatureCosmjsBase64);
// 	return signatureCosmjsBase64;
// }
