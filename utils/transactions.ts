import { TRX_FEE, TRX_MSG } from 'types/transactions';
import { b58_to_b64 } from './encoding';

export const defaultTrxFee: TRX_FEE = {
	amount: [{ amount: String(5000), denom: 'uixo' }],
	gas: String(300000),
};

export const generateKeysafeTx = (
	msgs: TRX_MSG[],
	signature: any,
	account_number: string,
	sequence: string,
	fee = defaultTrxFee,
) => {
	return {
		msg: msgs,
		fee: fee,
		signatures: [
			{
				signature: signature.signatureValue, // expected to be base64 encoded
				account_number,
				sequence,
				pub_key: {
					type: 'tendermint/PubKeyEd25519',
					value: b58_to_b64(signature.publicKey),
				},
			},
		],
		memo: '',
	};
};

export const sortObject = (obj: any): any => {
	if (obj === null) {
		return null;
	}
	if (typeof obj !== 'object') {
		return obj;
	}
	if (Array.isArray(obj)) {
		return obj.map(sortObject);
	}
	const sortedKeys = Object.keys(obj).sort();
	const result = {};
	sortedKeys.forEach((key) => {
		result[key] = sortObject(obj[key]);
	});

	return result;
};
