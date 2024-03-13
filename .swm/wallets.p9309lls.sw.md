---
id: p9309lls
title: Wallets
file_version: 1.1.3
app_version: 1.15.3
---

In this document will be discovered utils for wallets.

<br/>

Returnes only available for swap grouped wallet and contract tokens.

<!-- NOTE-swimm-snippet: the lines below link your snippet to Swimm -->

### 📄 utils/wallets.ts

```typescript
34     export const groupWalletSwapAssets = (balances: CURRENCY_TOKEN[], tokenBalances: CURRENCY_TOKEN[]): TOKEN_BALANCE[] => {
35       const assets = new Map<string, TOKEN_BALANCE>();
36
37       setAssetsByBalances(assets, getSwapTokens(balances));
38       setAssetsByBalances(assets, tokenBalances);
39
40       return Array.from(assets.values());
41     };
```

<br/>

<br/>

<br/>

This file was generated by Swimm. [Click here to view it in the app](https://app.swimm.io/repos/Z2l0aHViJTNBJTNBamFtYm8lM0ElM0FpeG9mb3VuZGF0aW9u/docs/p9309lls).