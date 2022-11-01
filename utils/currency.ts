import { findTokenFromDenom } from '@constants/chains';
import { ArrayElement } from 'types/general';
import { Currency } from 'types/wallet';

export const apiCurrencyToCurrency = (currency: any): Currency => ({
	amount: currency.amount ? parseInt(currency.amount, 10) : 0,
	denom: currency.denom,
});

export const formatUSDAmount = (amount: number) => formatterUSD.format(amount);

export const formatterUSD = new Intl.NumberFormat('en-US', {
	style: 'currency',
	currency: 'USD',
	//minimumFractionDigits: 0, // (this suffices for whole numbers, but will print 2500.10 as $2,500.1)
	//maximumFractionDigits: 0, // (causes 2500.99 to be printed as $2,501)
});

export const formatTokenAmount = (amount: number, microUnits: boolean = true) => formatterToken.format(microUnits ? amount / 10 ** 6 : amount);

export const formatterToken = new Intl.NumberFormat('en-US', {
	//minimumFractionDigits: 0, // (this suffices for whole numbers, but will print 2500.10 as $2,500.1)
	maximumFractionDigits: 6, // (causes 2500.99 to be printed as $2,501)
});

export type TokenDropdownType = ArrayElement<ReturnType<typeof generateUserTokensDropdown>>;

export type TOKEN_ASSET = {
	coinDenom: string;
	coinMinimalDenom: string;
	coinDecimals: number;
	coinGeckoId: string;
	coinImageUrl: string;
	isStakeCurrency?: boolean;
	isFeeCurrency?: boolean;
};

export const generateUserTokensDropdown = (balances: Currency[]) => {
	return balances.map(b => {
		const asset = findTokenFromDenom(b.denom);
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
