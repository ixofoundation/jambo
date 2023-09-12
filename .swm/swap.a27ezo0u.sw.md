---
id: a27ezo0u
title: Swap
file_version: 1.1.3
app_version: 1.15.3
---

In this document will be discovered components for swap.

# `Swap`<swm-token data-swm-token=":components/Swap/Swap.tsx:36:4:4:`export const Swap = (props: SwapProps) =&gt; {`"/>

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

# `SwapTokens`<swm-token data-swm-token=":steps/SwapTokens.tsx:46:2:2:`const SwapTokens: FC&lt;SwapTokensProps&gt; = ({ onBack, data, header, loading = false, signedIn = true }) =&gt; {`"/>

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
68       const formIsValid = () => {
69         const inputValid =
70           !!inputToken &&
71           Number.parseFloat(inputAmount) > 0 &&
72           validateAmountAgainstBalance(
73             Number.parseFloat(inputAmount),
74             Number(inputToken.amount),
75             !isCw1155Token(inputToken.denom),
76           );
77         const outputValid = !!outputToken && Number.parseFloat(outputAmount) > 0;
78
79         return inputToken !== outputToken && inputValid && outputValid;
80       };
```

<br/>

Creates and executes swap transaction when provided input and output tokens are valid.

<!-- NOTE-swimm-snippet: the lines below link your snippet to Swimm -->

### 📄 steps/SwapTokens.tsx

<!-- collapsed -->

```tsx
82       const signTX = async (): Promise<void> => {
83         if (!inputToken || !outputToken || !queryClient) return;
84         setTrxLoading(true);
85
86         const inputTokenSelect = getTokenSelectByDenom(inputToken.denom);
87         const inputTokenAmount = getInputTokenAmount(inputToken, inputTokenSelect, inputAmount);
88
89         const outputTokenSelect = getTokenSelectByDenom(outputToken.denom);
90         const outputTokenAmount = getOutputTokenAmount(outputTokenSelect, outputAmount, slippage);
91
92         const funds = getSwapFunds(inputToken.denom, inputAmount);
93         const swapContractAddress = getSwapContractAddress(inputToken.denom, outputToken.denom);
94
95         const trxs = [];
96         const tokenInfo = getTokenInfoByDenom(inputToken.denom);
97         if (tokenInfo.type == TokenType.Cw1155) {
98           const isSwapContractApproved = await queryApprovalVerification(
99             queryClient,
100            wallet.user?.address!,
101            swapContractAddress,
102            tokenInfo.address!,
103          );
104          console.log(isSwapContractApproved);
105
106          if (!isSwapContractApproved)
107            trxs.push(
108              generateApproveTrx({
109                contract: tokenInfo.address!,
110                operator: swapContractAddress,
111                sender: wallet.user?.address!,
112              }),
113            );
114        }
115
116        trxs.push(
117          generateSwapTrx({
118            contract: swapContractAddress,
119            inputTokenSelect,
120            inputTokenAmount,
121            outputTokenAmount,
122            sender: wallet.user?.address!,
123            funds,
124          }),
125        );
126        const hash = await broadCastMessages(
127          wallet,
128          trxs,
129          undefined,
130          defaultTrxFeeOption,
131          '',
132          chainInfo as KEPLR_CHAIN_INFO_TYPE,
133        );
134
135        if (hash) setSuccessHash(hash);
136        setTrxLoading(false);
137      };
```

<br/>

This file was generated by Swimm. [Click here to view it in the app](https://app.swimm.io/repos/Z2l0aHViJTNBJTNBamFtYm8lM0ElM0FpeG9mb3VuZGF0aW9u/docs/a27ezo0u).
