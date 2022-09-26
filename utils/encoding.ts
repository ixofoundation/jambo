import * as base58 from 'bs58';
import { BigNumber } from 'bignumber.js';

export const utf16_to_b64 = (str: string) => {
	return Buffer.from(str, 'utf8').toString('base64');
};

export const file_to_b64 = (file: File): Promise<string> => {
	return new Promise<string>((resolve, reject) => {
		const reader = new FileReader();
		reader.readAsDataURL(file);
		reader.onload = () => resolve(reader.result?.toString() || '');
		reader.onerror = error => reject(error);
	});
};

export const b58_to_b64 = (str: string | undefined): string | undefined | null => {
	if (!str) return str;
	return base58.decode(str).toString('base64');
};

export const getMicroAmount = (amount: string): string => {
	return new BigNumber(amount).times(new BigNumber(10).pow(6)).toString();
};
