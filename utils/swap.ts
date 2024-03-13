import { pools, tokens } from '@constants/pools';
import { Token, TokenAmount, TokenSelect, TokenType } from 'types/swap';
import { CURRENCY_TOKEN } from 'types/wallet';

import { getMicroAmount } from './encoding';

export const getInputTokenAmount = (
  token: CURRENCY_TOKEN,
  tokenSelect: TokenSelect,
  tokenAmount: string,
): TokenAmount => {
  if (tokenSelect === TokenSelect.Token1155 && token.batches) {
    let totalInputAmountRest = Number(tokenAmount);
    let inputTokenBatches = new Map<string, string>();
    for (const [tokenId, amount] of token.batches) {
      const tokenAmount = Number(amount);

      if (tokenAmount) {
        if (tokenAmount > totalInputAmountRest) {
          inputTokenBatches.set(tokenId, totalInputAmountRest.toString());
          totalInputAmountRest = 0;
        } else {
          inputTokenBatches.set(tokenId, amount);
          totalInputAmountRest -= tokenAmount;
        }
      }

      if (!totalInputAmountRest) break;
    }

    return { multiple: Object.fromEntries(inputTokenBatches) };
  } else {
    return { single: getMicroAmount(tokenAmount) };
  }
};
export const getOutputTokenAmount = (tokenSelect: TokenSelect, tokenAmount: string, slippage: number): TokenAmount => {
  const outputAmountNumber =
    tokenSelect === TokenSelect.Token1155
      ? Number.parseFloat(tokenAmount)
      : Number.parseFloat(getMicroAmount(tokenAmount));
  const outPutAmountWithSlippage = outputAmountNumber - outputAmountNumber * (slippage / 100);

  return { single: outPutAmountWithSlippage.toFixed() };
};

export const getSwapTokens = (walletTokens: CURRENCY_TOKEN[]): CURRENCY_TOKEN[] =>
  walletTokens.filter((token) => tokens.has(token.denom));
export const getSwapContractsOutputsForInputDenoms = (inputDenom: string): CURRENCY_TOKEN[] => {
  let tokensForSwap: { denom: string; type: TokenType }[] = [];
  tokens.forEach((token, key) => {
    if (key == inputDenom) {
      return;
    } else {
      if (token.type === TokenType.Cw1155) {
        if (pools.get({ token1155: key, token2: inputDenom })) {
          tokensForSwap.push({ denom: key, type: token.type });
        }
      } else {
        if (pools.get({ token1155: inputDenom, token2: key })) {
          tokensForSwap.push({ denom: key, type: token.type });
        }
      }
    }
  });
  return tokensForSwap.map((token) => ({ denom: token.denom, amount: '0', ibc: false }));
};
export const getSwapContractAddress = (inputDenom: string, outputDenom: string): string =>
  getTokenSelectByDenom(inputDenom) === TokenSelect.Token1155
    ? pools.get({ token1155: inputDenom, token2: outputDenom })
    : pools.get({ token1155: outputDenom, token2: inputDenom });
export const getSwapFunds = (inputTokenDenom: string, inputAmount: string): Map<string, string> => {
  const funds = new Map<string, string>();
  if (getTokenInfoByDenom(inputTokenDenom).type === TokenType.Native) {
    funds.set(inputTokenDenom, getMicroAmount(inputAmount));
  }

  return funds;
};

export const getTokenSelectByDenom = (denom: string): TokenSelect =>
  getTokenInfoByDenom(denom).type === TokenType.Cw1155 ? TokenSelect.Token1155 : TokenSelect.Token2;
export const getTokenInfoByDenom = (denom: string): Token => tokens.get(denom)!;
export const isCw1155Token = (denom: string) => getTokenInfoByDenom(denom)?.type === TokenType.Cw1155;
