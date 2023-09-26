---
id: a0tgb5pl
title: Swap
file_version: 1.1.3
app_version: 1.15.3
---

In this document will be discovered types for swap.

# `Pool`<swm-token data-swm-token=":types/swap.ts:1:4:4:`export type Pool = {`"/>

In order to keep information which token pair is used in liquidity pool we need to use `Pool`<swm-token data-swm-token=":types/swap.ts:1:4:4:`export type Pool = {`"/> type.

## Type

<br/>

Type consists of 2 mandatory fields:

- `token1155`<swm-token data-swm-token=":types/swap.ts:2:1:1:`  token1155: string;`"/> - denom of token

- `token2`<swm-token data-swm-token=":types/swap.ts:3:1:1:`  token2: string;`"/> - denom of token
<!-- NOTE-swimm-snippet: the lines below link your snippet to Swimm -->

### 📄 types/swap.ts

```typescript
1      export type Pool = {
2        token1155: string;
3        token2: string;
4      };
```

<br/>

## Example

```json
{
  "token1155": "CARBON",
  "token2": "uixo"
}
```

# `TokenType`<swm-token data-swm-token=":types/swap.ts:27:4:4:`  type: TokenType;`"/>

In order to keep information about the type of token we need to use `TokenType`<swm-token data-swm-token=":types/swap.ts:30:4:4:`export enum TokenType {`"/> type.

## Type

<br/>

Type could be one of the following options:

- `Cw1155`<swm-token data-swm-token=":types/swap.ts:31:1:1:`  Cw1155,`"/> - token follows [CW1155 specification](https://docs.rs/cw1155/latest/cw1155/) and managed by smart-contract.

- `Cw20`<swm-token data-swm-token=":types/swap.ts:32:1:1:`  Cw20,`"/> - contract token follow [CW20 specification](https://docs.rs/cw20/latest/cw20/) and managed by smart-contract.

- `Native`<swm-token data-swm-token=":types/swap.ts:33:1:1:`  Native,`"/> - token managed by blockchain core.
<!-- NOTE-swimm-snippet: the lines below link your snippet to Swimm -->

### 📄 types/swap.ts

```typescript
30     export enum TokenType {
31       Cw1155,
32       Cw20,
33       Native,
34     }
```

<br/>

# `Token`<swm-token data-swm-token=":types/swap.ts:26:4:4:`export type Token = {`"/>

In order to keep inforamtion about token for swap we need to use `Token`<swm-token data-swm-token=":types/swap.ts:26:4:4:`export type Token = {`"/> type.

## Type

<br/>

Type consists of 1 mandatory field:

- `type`<swm-token data-swm-token=":types/swap.ts:27:1:1:`  type: TokenType;`"/> - type of token

and 1 optional:

- `address`<swm-token data-swm-token=":types/swap.ts:28:1:1:`  address?: string;`"/> - address of token contract. Used in case of `Cw1155`<swm-token data-swm-token=":types/swap.ts:31:1:1:`  Cw1155,`"/> and `Cw20`<swm-token data-swm-token=":types/swap.ts:32:1:1:`  Cw20,`"/> tokens.
<!-- NOTE-swimm-snippet: the lines below link your snippet to Swimm -->

### 📄 types/swap.ts

```typescript
26     export type Token = {
27       type: TokenType;
28       address?: string;
29     };
```

<br/>

# `AmountType`<swm-token data-swm-token=":types/swap.ts:38:4:4:`export enum AmountType {`"/>

In order to keep information about token amount type we need to use `AmountType`<swm-token data-swm-token=":types/swap.ts:38:4:4:`export enum AmountType {`"/> type.

## Type

<br/>

Type could be one of the following options:

- `Single`<swm-token data-swm-token=":types/swap.ts:39:1:1:`  Single = &#39;single&#39;,`"/> - used for `Cw20`<swm-token data-swm-token=":types/swap.ts:32:1:1:`  Cw20,`"/> and `Native`<swm-token data-swm-token=":types/swap.ts:33:1:1:`  Native,`"/>, when only single token amount is needed

- `Multiple`<swm-token data-swm-token=":types/swap.ts:40:1:1:`  Multiple = &#39;multiple&#39;,`"/> - used for `Cw1155`<swm-token data-swm-token=":types/swap.ts:31:1:1:`  Cw1155,`"/>batches, when multiple token amounts are needed
<!-- NOTE-swimm-snippet: the lines below link your snippet to Swimm -->

### 📄 types/swap.ts

```typescript
38     export enum AmountType {
39       Single = 'single',
40       Multiple = 'multiple',
41     }
```

<br/>

# `TokenAmount`<swm-token data-swm-token=":types/swap.ts:35:4:4:`export type TokenAmount = {`"/>

In order to keep information about token amount for swap we need to use `TokenAmount`<swm-token data-swm-token=":types/swap.ts:35:4:4:`export type TokenAmount = {`"/> type.

## Type

<br/>

Type consists of the `AmountType`<swm-token data-swm-token=":types/swap.ts:38:4:4:`export enum AmountType {`"/> key and appropriate amount value:

- string for `Single`<swm-token data-swm-token=":types/swap.ts:39:1:1:`  Single = &#39;single&#39;,`"/> amount type

- map for `Multiple`<swm-token data-swm-token=":types/swap.ts:40:1:1:`  Multiple = &#39;multiple&#39;,`"/>amount type, where as a key takes `Cw1155`<swm-token data-swm-token=":types/swap.ts:31:1:1:`  Cw1155,`"/>batch id and needed amount from batch as a value
<!-- NOTE-swimm-snippet: the lines below link your snippet to Swimm -->

### 📄 types/swap.ts

```typescript
35     export type TokenAmount = {
36       [key in AmountType]?: string | ObjectMap;
37     };
```

<br/>

## Example

```json
{
  "multiple": {
    "c90cf65fe3795e85a76a4b1daa7e36a6": "4864",
    "db03fa33c1e2ca35794adbb14aebb153": "1136"
  }
}
```

```json
{
  "single": "1000000"
}
```

# `TokenSelect`<swm-token data-swm-token=":types/swap.ts:42:4:4:`export enum TokenSelect {`"/>

In order to keep information which token is going to be used for swap we need to use `TokenAmount`<swm-token data-swm-token=":types/swap.ts:35:4:4:`export type TokenAmount = {`"/> type.

## Type

<br/>

Type could be one of the following options:

- `Token1155`<swm-token data-swm-token=":types/swap.ts:43:1:1:`  Token1155 = &#39;token1155&#39;,`"/> - when `Cw1155`<swm-token data-swm-token=":types/swap.ts:31:1:1:`  Cw1155,`"/> is going to be swapped

- `Token2`<swm-token data-swm-token=":types/swap.ts:44:1:1:`  Token2 = &#39;token2&#39;,`"/> - when `Cw20`<swm-token data-swm-token=":types/swap.ts:32:1:1:`  Cw20,`"/> or `Native`<swm-token data-swm-token=":types/swap.ts:33:1:1:`  Native,`"/> is going to be swapped
<!-- NOTE-swimm-snippet: the lines below link your snippet to Swimm -->

### 📄 types/swap.ts

```typescript
42     export enum TokenSelect {
43       Token1155 = 'token1155',
44       Token2 = 'token2',
45     }
```

<br/>

This file was generated by Swimm. [Click here to view it in the app](https://app.swimm.io/repos/Z2l0aHViJTNBJTNBamFtYm8lM0ElM0FpeG9mb3VuZGF0aW9u/docs/a0tgb5pl).
