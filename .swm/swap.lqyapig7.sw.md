---
id: lqyapig7
title: Swap
file_version: 1.1.3
app_version: 1.15.3
---

In this document will be discovered utils for swap.

<br/>

Returns formatted amount for input token based on token selecetion. In case of

- `Token1155`<swm-token data-swm-token=":types/swap.ts:43:1:1:`  Token1155 = &#39;token1155&#39;,`"/> iterates through all user batches until it gets provided input amount

- `Token2`<swm-token data-swm-token=":types/swap.ts:44:1:1:`  Token2 = &#39;token2&#39;,`"/> returns the provided amount
<!-- NOTE-swimm-snippet: the lines below link your snippet to Swimm -->

### 📄 utils/swap.ts

<!-- collapsed -->

```typescript
7      export const getInputTokenAmount = (
8        token: CURRENCY_TOKEN,
9        tokenSelect: TokenSelect,
10       tokenAmount: string,
11     ): TokenAmount => {
12       if (tokenSelect === TokenSelect.Token1155 && token.batches) {
13         let totalInputAmountRest = Number(tokenAmount);
14         let inputTokenBatches = new Map<string, string>();
15         for (const [tokenId, amount] of token.batches) {
16           const tokenAmount = Number(amount);
17
18           if (tokenAmount) {
19             if (tokenAmount > totalInputAmountRest) {
20               inputTokenBatches.set(tokenId, totalInputAmountRest.toString());
21               totalInputAmountRest = 0;
22             } else {
23               inputTokenBatches.set(tokenId, amount);
24               totalInputAmountRest -= tokenAmount;
25             }
26           }
27
28           if (!totalInputAmountRest) break;
29         }
30
31         return { multiple: Object.fromEntries(inputTokenBatches) };
32       } else {
33         return { single: getMicroAmount(tokenAmount) };
34       }
35     };
```

<br/>

Returns formatted amount with calculated slippage for output token based on token selection.

<!-- NOTE-swimm-snippet: the lines below link your snippet to Swimm -->

### 📄 utils/swap.ts

<!-- collapsed -->

```typescript
36     export const getOutputTokenAmount = (tokenSelect: TokenSelect, tokenAmount: string, slippage: number): TokenAmount => {
37       const outputAmountNumber =
38         tokenSelect === TokenSelect.Token1155
39           ? Number.parseFloat(tokenAmount)
40           : Number.parseFloat(getMicroAmount(tokenAmount));
41       const outPutAmountWithSlippage = outputAmountNumber - outputAmountNumber * (slippage / 100);
42
43       return { single: outPutAmountWithSlippage.toFixed() };
44     };
```

<br/>

Returns filtered array which includes only available for swap tokens.

<!-- NOTE-swimm-snippet: the lines below link your snippet to Swimm -->

### 📄 utils/swap.ts

<!-- collapsed -->

```typescript
46     export const getSwapTokens = (walletTokens: CURRENCY_TOKEN[]): CURRENCY_TOKEN[] =>
47       walletTokens.filter((token) => tokens.has(token.denom));
```

<br/>

Returns address of swap contract based on the provided denoms of input and output tokens.

<!-- NOTE-swimm-snippet: the lines below link your snippet to Swimm -->

### 📄 utils/swap.ts

<!-- collapsed -->

```typescript
49     export const getSwapContractAddress = (inputDenom: string, outputDenom: string): string =>
50       getTokenSelectByDenom(inputDenom) === TokenSelect.Token1155
51         ? pools.get({ token1155: inputDenom, token2: outputDenom })
52         : pools.get({ token1155: outputDenom, token2: inputDenom });
```

<br/>

Returns funds for swap transaction based on input denom and amount. Not empty only in case of `Native`<swm-token data-swm-token=":types/swap.ts:33:1:1:`  Native,`"/> token.

<!-- NOTE-swimm-snippet: the lines below link your snippet to Swimm -->

### 📄 utils/swap.ts

<!-- collapsed -->

```typescript
52     export const getSwapFunds = (inputTokenDenom: string, inputAmount: string): Map<string, string> => {
53       const funds = new Map<string, string>();
54       if (getTokenInfoByDenom(inputTokenDenom).type === TokenType.Native) {
55         funds.set(inputTokenDenom, getMicroAmount(inputAmount));
56       }
57
58       return funds;
59     };
```

<br/>

Returns token selection based on provided token denom.

<!-- NOTE-swimm-snippet: the lines below link your snippet to Swimm -->

### 📄 utils/swap.ts

<!-- collapsed -->

```typescript
61     export const getTokenSelectByDenom = (denom: string): TokenSelect =>
62       getTokenInfoByDenom(denom).type === TokenType.Cw1155 ? TokenSelect.Token1155 : TokenSelect.Token2;
```

<br/>

Returns pool token information based on provided token denom.

<!-- NOTE-swimm-snippet: the lines below link your snippet to Swimm -->

### 📄 utils/swap.ts

<!-- collapsed -->

```typescript
63     export const getTokenInfoByDenom = (denom: string): Token => tokens.get(denom)!;
```

<br/>

Checks if token has `Cw1155`<swm-token data-swm-token=":types/swap.ts:31:1:1:`  Cw1155,`"/> type based on provided token denom.

<!-- NOTE-swimm-snippet: the lines below link your snippet to Swimm -->

### 📄 utils/swap.ts

<!-- collapsed -->

```typescript
64     export const isCw1155Token = (denom: string) => getTokenInfoByDenom(denom)?.type === TokenType.Cw1155;
```

<br/>

This file was generated by Swimm. [Click here to view it in the app](https://app.swimm.io/repos/Z2l0aHViJTNBJTNBamFtYm8lM0ElM0FpeG9mb3VuZGF0aW9u/docs/lqyapig7).
