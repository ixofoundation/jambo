---
id: jp6f2q9i
title: Swap
file_version: 1.1.3
app_version: 1.15.3
---

In this document will be discovered queries for swap.

<br/>

Returns the possible output token amount based on provided input token amount and type selection.

<!-- NOTE-swimm-snippet: the lines below link your snippet to Swimm -->

### 📄 utils/query.ts

<!-- collapsed -->

```typescript
47     export const queryOutputAmountByInputAmount = async (
48       queryClient: QUERY_CLIENT,
49       inputToken: TokenSelect,
50       inputAmount: TokenAmount,
51       address: string,
52     ): Promise<string> => {
53       try {
54         const queryAmount = async (address: string, query: string) =>
55           queryClient.cosmwasm.wasm.v1.smartContractState({
56             address,
57             queryData: strToArray(query),
58           });
59
60         switch (inputToken) {
61           case TokenSelect.Token1155: {
62             const query = { token1155_for_token2_price: { token1155_amount: inputAmount } };
63             const response = await queryAmount(address, JSON.stringify(query));
64
65             return JSON.parse(uint8ArrayToStr(response.data)).token2_amount;
66           }
67           case TokenSelect.Token2: {
68             const query = { token2_for_token1155_price: { token2_amount: inputAmount } };
69             const response = await queryAmount(address, JSON.stringify(query));
70
71             return JSON.parse(uint8ArrayToStr(response.data)).token1155_amount;
72           }
73         }
74       } catch (error) {
75         console.error('queryOutputAmountByInputAmount::', error);
76         return '0';
77       }
78     };
```

<br/>

Returns transaction result based on provided transaction hash.

<!-- NOTE-swimm-snippet: the lines below link your snippet to Swimm -->

### 📄 utils/query.ts

<!-- collapsed -->

```typescript
58     export const queryTrxResult = async (queryClient: QUERY_CLIENT, trxHash: string) => {
59       try {
60         return queryClient.cosmos.tx.v1beta1.getTx({ hash: trxHash });
61       } catch (error) {
62         console.error('queryTrxResult::', error);
63         return;
64       }
65     };
```

<br/>

Returns balances of all available for swap tokens. In case of

- `Cw1155`<swm-token data-swm-token=":types/swap.ts:31:1:1:`  Cw1155,`"/> token, fetches batches and balances of them from token contract

- `Cw20`<swm-token data-swm-token=":types/swap.ts:32:1:1:`  Cw20,`"/> token, fetches just balance from token contract
<!-- NOTE-swimm-snippet: the lines below link your snippet to Swimm -->

### 📄 utils/query.ts

<!-- collapsed -->

```typescript
67     export const queryTokenBalances = async (
68       queryClient: QUERY_CLIENT,
69       chain: string,
70       address: string,
71     ): Promise<CURRENCY_TOKEN[]> => {
72       try {
73         const balances: CURRENCY_TOKEN[] = [];
74         const batches: Map<string, string> = new Map();
75         for (const [denom, token] of tokens) {
76           switch (token.type) {
77             case TokenType.Cw1155: {
78               const ownerTokensQuery = { tokens: { owner: address } };
79               const ownerTokensResponse = await queryClient.cosmwasm.wasm.v1.smartContractState({
80                 address: token.address!,
81                 queryData: strToArray(JSON.stringify(ownerTokensQuery)),
82               });
83               const ownerTokenIds: string[] = JSON.parse(uint8ArrayToStr(ownerTokensResponse.data)).tokens;
84
85               const ownerBalancesQuery = {
86                 batch_balance: {
87                   owner: address,
88                   token_ids: ownerTokenIds,
89                 },
90               };
91               const ownerBalancesResponse = await queryClient.cosmwasm.wasm.v1.smartContractState({
92                 address: token.address!,
93                 queryData: strToArray(JSON.stringify(ownerBalancesQuery)),
94               });
95               const ownerBalances = JSON.parse(uint8ArrayToStr(ownerBalancesResponse.data)).balances;
96               const totalBalance = ownerBalances.reduce((prev: string, current: string) => Number(prev) + Number(current));
97
98               for (const [index, tokenId] of ownerTokenIds.entries()) {
99                 batches.set(tokenId, ownerBalances[index].toString());
100              }
101
102              balances.push({ denom, amount: totalBalance.toString(), batches, ibc: false, chain });
103              break;
104            }
105            case TokenType.Cw20: {
106              const query = { balance: { address } };
107              const response = await queryClient.cosmwasm.wasm.v1.smartContractState({
108                address: token.address!,
109                queryData: strToArray(JSON.stringify(query)),
110              });
111
112              balances.push({ denom, amount: JSON.parse(uint8ArrayToStr(response.data)).balance, ibc: false, chain });
113              break;
114            }
115          }
116        }
117
118        return balances;
119      } catch (error) {
120        console.error('queryTokenBalances::', error);
121        return [];
122      }
123    };
```

<br/>

Return an approval to manage `Cw1155`<swm-token data-swm-token=":types/swap.ts:31:1:1:`  Cw1155,`"/> contract tokens

<!-- NOTE-swimm-snippet: the lines below link your snippet to Swimm -->

### 📄 utils/query.ts

```typescript
26     export const queryApprovalVerification = async (
27       queryClient: QUERY_CLIENT,
28       owner: string,
29       operator: string,
30       address: string,
31     ): Promise<boolean> => {
32       try {
33         const response = await queryClient.cosmwasm.wasm.v1.smartContractState({
34           address,
35           queryData: strToArray(
36             JSON.stringify({
37               is_approved_for_all: {
38                 owner,
39                 operator,
40               },
41             }),
42           ),
43         });
44
45         return JSON.parse(uint8ArrayToStr(response.data)).approved;
46       } catch (error) {
47         console.error('queryApprovalVerification::', error);
48         return false;
49       }
```

<br/>

This file was generated by Swimm. [Click here to view it in the app](https://app.swimm.io/repos/Z2l0aHViJTNBJTNBamFtYm8lM0ElM0FpeG9mb3VuZGF0aW9u/docs/jp6f2q9i).
