import { TokenAsset } from '@ixo/impactxclient-sdk/types/custom_queries/chain.types';
import { customQueries } from '@ixo/impactxclient-sdk';

import { ArrayElement } from 'types/general';
import { CURRENCY } from 'types/wallet';

export const formatUSDAmount = (amount: number) => formatterUSD.format(amount);

export const formatterUSD = new Intl.NumberFormat('en-US', {
	style: 'currency',
	currency: 'USD',
	//minimumFractionDigits: 0, // (this suffices for whole numbers, but will print 2500.10 as $2,500.1)
	//maximumFractionDigits: 0, // (causes 2500.99 to be printed as $2,501)
});

export const calculateTokenAmount = (amount: number, microUnits: boolean = true, roundAmount: boolean = false) => {
	let tokenAmount = amount;
	if (microUnits) tokenAmount = tokenAmount / Math.pow(10, 6);
	if (roundAmount && tokenAmount >= 1) tokenAmount = Math.floor(tokenAmount);
	return tokenAmount;
};

export const formatTokenAmount = (amount: number, microUnits: boolean = true, roundAmount: boolean = false) => {
	const tokenAmount = calculateTokenAmount(amount, microUnits, roundAmount);
	return formatterToken.format(tokenAmount);
};

export const formatterToken = new Intl.NumberFormat('en-US', {
	//minimumFractionDigits: 0, // (this suffices for whole numbers, but will print 2500.10 as $2,500.1)
	maximumFractionDigits: 6, // (causes 2500.99 to be printed as $2,501)
});

export type TokenDropdownType = ArrayElement<ReturnType<typeof generateUserTokensDropdown>>;

export type TOKEN_ASSET = TokenAsset;

export const generateUserTokensDropdown = (balances: CURRENCY[]) => {
	return balances.map((b) => {
		const asset = customQueries.currency.findTokenFromDenom(b.denom);
		return {
			value: b.denom,
			label: asset?.coinDenom ?? b.denom,
			img: asset?.coinImageUrl,
			amount: b.amount,
		};
	});
};

export const validateAmountAgainstBalance = (amount: number, balance: number, balanceMicroUnits: boolean = true) => {
	const realBalance = balanceMicroUnits ? balance / 10 ** 6 : balance;
	return amount <= realBalance;
};

export const getFeeDenom = (suggestedDenom: string = '', feeCurrencies: TOKEN_ASSET[]): string => {
	if (suggestedDenom) {
		const suggestedTokenAsset = customQueries.currency.findTokenFromDenom(suggestedDenom);
		if (suggestedTokenAsset?.isFeeCurrency) return suggestedTokenAsset.coinMinimalDenom;
	}
	const feeCurrency = feeCurrencies.find((cur: TOKEN_ASSET) => {
		const curTokenAsset = customQueries.currency.findTokenFromDenom(cur.coinMinimalDenom);
		if (!curTokenAsset.isFeeCurrency) return;
		return cur;
	});
	if (feeCurrency) return feeCurrency.coinMinimalDenom;
	throw new Error('Cannot determine fee denom');
};

export const getDisplayDenomFromDenom = (denom: string): string => {
	const token = customQueries.currency.findTokenFromDenom(denom);
	if (token?.coinDenom) return token.coinDenom;
	return '';
};
