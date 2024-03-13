import { customQueries } from '@ixo/impactxclient-sdk';
import { TokenAsset } from '@ixo/impactxclient-sdk/types/custom_queries/currency.types';

import { ArrayElement } from 'types/general';
import { CURRENCY, CURRENCY_TOKEN } from 'types/wallet';

import { isCw1155Token } from './swap';

export const formatUSDAmount = (amount: number) => formatterUSD.format(amount);

export const formatterUSD = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  //minimumFractionDigits: 0, // (this suffices for whole numbers, but will print 2500.10 as $2,500.1)
  //maximumFractionDigits: 0, // (causes 2500.99 to be printed as $2,501)
});

export const microAmountToAmount = (microAmount: number, microUnits: number = 6) => {
  const amount = (microAmount ?? 0) / Math.pow(10, microUnits);
  return amount;
};

export const calculateTokenAmount = (amount: number, microUnits: number = 6, floorAmount: boolean = false) => {
  let tokenAmount = amount;
  if (!amount) return 0;
  if (microUnits) tokenAmount = microAmountToAmount(tokenAmount, microUnits);
  if (floorAmount && tokenAmount >= 1) tokenAmount = Math.floor(tokenAmount);
  return tokenAmount;
};

export const formatTokenAmountByDenom = (denom: string, amount: number) =>
  formatTokenAmount(amount, isCw1155Token(denom) ? 0 : 6, false);

export const formatTokenAmount = (amount: number, microUnits: number = 6, floorAmount: boolean = false) => {
  const tokenAmount = calculateTokenAmount(amount, microUnits, floorAmount);
  return formatterTokenAmount.format(tokenAmount);
};

export const calculateMaxTokenAmount = (
  amount: number,
  microUnits: number = 6,
  floorAmount: boolean = false,
  decimalAmount: boolean = true,
) => {
  // assist user: subtract 0.3 for gas fees
  const maxTokenAmount = calculateTokenAmount(
    decimalAmount ? (amount >= 0.3 ? amount - 0.3 : 0) : amount,
    microUnits,
    floorAmount,
  );
  return formatterTokenAmount.format(maxTokenAmount);
};

export const formatterTokenAmount = new Intl.NumberFormat('en-US', {
  //minimumFractionDigits: 0, // (this suffices for whole numbers, but will print 2500.10 as $2,500.1)
  maximumFractionDigits: 6, // (causes 2500.99 to be printed as $2,501)
});

export const formattedAmountToNumber = (amount: string) => Number(amount?.replace(/\,/g, '') ?? 0);

export const amountToMicroAmount = (amount: number, microUnits: number = 6) => {
  const microAmount = (amount ?? 0) * Math.pow(10, microUnits);
  return microAmount;
};

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
  const realBalance = balanceMicroUnits ? balance / Math.pow(10, 6) : balance;
  return amount <= realBalance;
};

export const getFeeDenom = (suggestedDenom: string = '', feeCurrencies: TOKEN_ASSET[]): string => {
  if (suggestedDenom) {
    const suggestedTokenAsset = customQueries.currency.findTokenFromDenom(suggestedDenom);
    if (suggestedTokenAsset?.isFeeCurrency && feeCurrencies.some((currency) => currency.coinDenom === suggestedDenom))
      return suggestedTokenAsset.coinMinimalDenom;
  }
  const feeCurrency = feeCurrencies.find((cur: TOKEN_ASSET) => {
    const curTokenAsset = customQueries.currency.findTokenFromDenom(cur.coinMinimalDenom);
    if (!curTokenAsset.isFeeCurrency) return;
    return cur;
  });
  if (feeCurrency) return feeCurrency.coinMinimalDenom;
  throw new Error('Cannot determine fee denom');
};

export const getDisplayDenomFromDenom = (denom: string, tokenAsset?: TokenAsset): string => {
  const token = tokenAsset ?? customQueries.currency.findTokenFromDenom(denom);
  if (token?.coinDenom) return token.coinDenom;
  return '';
};

export const getMicroUnitsFromDenom = (denom: string, tokenAsset?: TokenAsset): number => {
  const token = tokenAsset ?? customQueries.currency.findTokenFromDenom(denom);
  if (token?.coinDecimals) return token.coinDecimals;
  return 0;
};

export const validateIbcDenom = (denom: string) => /^ibc\//i.test(denom);

export const getMicroUnitsFromCurrencyToken = (currencyToken?: CURRENCY_TOKEN) =>
  Number(currencyToken?.token?.coinDecimals ?? 0);

export const getDisplayDenomFromCurrencyToken = (currencyToken?: CURRENCY_TOKEN) =>
  currencyToken?.token?.coinDenom ?? currencyToken?.denom ?? '';

export const getDenomFromCurrencyToken = (currencyToken?: CURRENCY_TOKEN) => currencyToken?.denom ?? '';

export const getAmountFromCurrencyToken = (currencyToken?: CURRENCY_TOKEN) => Number(currencyToken?.amount ?? 0);

export const getDisplayAmountFromCurrencyToken = (currencyToken?: CURRENCY_TOKEN) =>
  formatTokenAmount(getAmountFromCurrencyToken(currencyToken), getMicroUnitsFromCurrencyToken(currencyToken));

export const getDecimalsFromCurrencyToken = (currencyToken?: CURRENCY_TOKEN) =>
  Number(currencyToken?.token?.coinDecimals ?? 0);

export const getIbcStatusFromCurrencyToken = (currencyToken?: CURRENCY_TOKEN) => currencyToken?.ibc ?? false;

export const getCoinImageUrlFromCurrencyToken = (currencyToken?: CURRENCY_TOKEN) => currencyToken?.token?.coinImageUrl;

export const getTokenTypeFromCurrencyToken = (currencyToken?: CURRENCY_TOKEN, chainName?: string) =>
  (currencyToken?.ibc ? 'ibc' : currencyToken?.chain) ?? chainName ?? '';

// let exampleCurrencyToken: CURRENCY_TOKEN = {
// 	amount: '5',
// 	denom: 'ibc/OsmO',
// 	ibc: true,
// 	token: {
// 		coinDenom: 'osmos',
// 		coinMinimalDenom: 'uosmo',
// 		coinDecimals: 6,
// 		coinGeckoId: 'osmo',
// 		coinImageUrl: 'https://www.google.com',
// 		isFeeCurrency: false,
// 		isStakeCurrency: false,
// 		gasPriceStep: {
// 			low: 0.1,
// 			average: 0.2,
// 			high: 0.3,
// 		},
// 	},
// };
