---
id: a27ezo0u
title: Swap
file_version: 1.1.3
app_version: 1.15.3
---

In this document will be discovered components for swap.

# `Swap`<swm-token data-swm-token=":components/Swap/Swap.tsx:30:4:4:`export const Swap = (props: SwapProps) =&gt; {`"/>

Component is used in order to allow user choose tokens and amounts for swap.

<br/>

Sets possible amount for output token when input token amount is provided.

<!-- NOTE-swimm-snippet: the lines below link your snippet to Swimm -->

### 📄 components/Swap/Swap.tsx

<!-- collapsed -->

```tsx
48         const getOutputAmount = async () => {
49           if (queryClient && inputToken && outputToken && inputAmount && inputToken !== outputToken) {
50             setAmountLoading(true);
51
52             const inputTokenSelect = getTokenSelectByDenom(inputToken.denom);
53             const inputTokenAmount = getInputTokenAmount(inputToken, inputTokenSelect, inputAmount);
54             const contractAddress = getSwapContractAddress(inputToken.denom, outputToken.denom);
55
56             const outputAmount = await queryOutputAmountByInputAmount(
57               queryClient,
58               inputTokenSelect,
59               inputTokenAmount,
60               contractAddress,
61             );
62
63             setOutputAmount(formatTokenAmountByDenom(outputToken.denom, Number(outputAmount)));
64             setAmountLoading(false);
65           }
66         };
```

<br/>

Returns combined wallet and contract tokens.

<!-- NOTE-swimm-snippet: the lines below link your snippet to Swimm -->

### 📄 components/Swap/Swap.tsx

<!-- collapsed -->

```tsx
71       const getTokenOptions = (): CURRENCY_TOKEN[] => {
72         const walletBalancesOptions = wallet.balances?.data ?? [];
73         const walletTokensOptions = wallet.tokenBalances?.data ?? [];
74
75         return [...getSwapTokens(walletBalancesOptions), ...walletTokensOptions];
76       };
```

<br/>

Sets input token. When chosen input token is the same as output token, then it swaps them.

<!-- NOTE-swimm-snippet: the lines below link your snippet to Swimm -->

### 📄 components/Swap/Swap.tsx

<!-- collapsed -->

```tsx
77       const handleInputTokenChange = (token: CURRENCY_TOKEN) => {
78         if (token == outputToken) {
79           setOutputToken(inputToken);
80           setOutputAmount(inputAmount);
81           setInputAmount(outputAmount);
82         }
83
84         setInputToken(token);
85       };
```

<br/>

Sets output token. When chosen output token is the same as input token, then it swaps them.

<!-- NOTE-swimm-snippet: the lines below link your snippet to Swimm -->

### 📄 components/Swap/Swap.tsx

<!-- collapsed -->

```tsx
86       const handleOutputTokenChange = (token: CURRENCY_TOKEN) => {
87         if (token == inputToken) {
88           setInputToken(outputToken);
89           setInputAmount(outputAmount);
90           setOutputAmount(inputAmount);
91         }
92
93         setOutputToken(token);
94       };
```

<br/>

# `SwapResult`<swm-token data-swm-token=":components/SwapResult/SwapResult.tsx:31:4:4:`export const SwapResult = ({ inputToken, outputToken, trxHash }: SwapResultProps) =&gt; {`"/>

Ccomponent is used in order to show updated balances after successful swap.

<br/>

Sets updated balances when transaction hash after swap is provided.

<!-- NOTE-swimm-snippet: the lines below link your snippet to Swimm -->

### 📄 components/SwapResult/SwapResult.tsx

<!-- collapsed -->

```tsx
38         const setUpdatedAmounts = async () => {
39           if (!queryClient) return;
40
41           const trxRes = await queryTrxResult(queryClient, trxHash);
42           if (!trxRes) return;
43
44           const tokenAmountSold = getValueFromTrxEvents(trxRes.txResponse!, 'wasm', 'token_sold');
45           const tokenAmountBought = getValueFromTrxEvents(trxRes.txResponse!, 'wasm', 'token_bought');
46
47           setUpdatedInputAmount(Number(inputToken.amount) - Number(tokenAmountSold));
48           setUpdatedOutputAmount(Number(outputToken.amount) + Number(tokenAmountBought));
49         };
```

<br/>

# `SwapTokens`<swm-token data-swm-token=":steps/SwapTokens.tsx:43:2:2:`const SwapTokens: FC&lt;SwapTokensProps&gt; = ({ onBack, data, header, loading = false, signedIn = true }) =&gt; {`"/>

Component combines all components and logic for full swap flow.

<br/>

Verifies that provided input and output tokens are valid for swap execution. Should verify that

- input and output tokens are chosen and not the same

- amounts of the input and output tokens are chosen

- user has enough amount of provided input token
<!-- NOTE-swimm-snippet: the lines below link your snippet to Swimm -->

### 📄 steps/SwapTokens.tsx

<!-- collapsed -->

```tsx
65       const formIsValid = () => {
66         const inputValid =
67           !!inputToken &&
68           Number.parseFloat(inputAmount) > 0 &&
69           validateAmountAgainstBalance(
70             Number.parseFloat(inputAmount),
71             Number(inputToken.amount),
72             isCw1155Token(inputToken.denom) ? false : true,
73           );
74         const outputValid = !!outputToken && Number.parseFloat(outputAmount) > 0;
75
76         return inputToken !== outputToken && inputValid && outputValid;
77       };
78
```

<br/>

Creates and executes swap transaction when provided input and output tokens are valid.

<!-- NOTE-swimm-snippet: the lines below link your snippet to Swimm -->

### 📄 steps/SwapTokens.tsx

<!-- collapsed -->

```tsx
79       const signTX = async (): Promise<void> => {
80         if (!inputToken || !outputToken) return;
81         setTrxLoading(true);
82
83         const inputTokenSelect = getTokenSelectByDenom(inputToken.denom);
84         const inputTokenAmount = getInputTokenAmount(inputToken, inputTokenSelect, inputAmount);
85
86         const outputTokenSelect = getTokenSelectByDenom(outputToken.denom);
87         const outputTokenAmount = getOutputTokenAmount(outputTokenSelect, outputAmount, slippage);
88
89         const funds = getSwapFunds(inputToken.denom, inputAmount);
90         const contractAddress = getSwapContractAddress(inputToken.denom, outputToken.denom);
91
92         const trx = generateSwapTrx({
93           contractAddress,
94           inputTokenSelect,
95           inputTokenAmount,
96           outputTokenAmount,
97           senderAddress: wallet.user?.address!,
98           funds,
99         });
100        const hash = await broadCastMessages(
101          wallet,
102          [trx],
103          undefined,
104          defaultTrxFeeOption,
105          '',
106          chainInfo as KEPLR_CHAIN_INFO_TYPE,
107        );
108
109        if (hash) setSuccessHash(hash);
110        setTrxLoading(false);
111      };
```

<br/>

This file was generated by Swimm. [Click here to view it in the app](https://app.swimm.io/repos/Z2l0aHViJTNBJTNBamFtYm8lM0ElM0FpeG9mb3VuZGF0aW9u/docs/a27ezo0u).
