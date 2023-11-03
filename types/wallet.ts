import { DecCoin } from '@ixo/impactxclient-sdk/types/codegen/cosmos/base/v1beta1/coin';

import { DELEGATION, DELEGATION_REWARDS, UNBONDING_DELEGATION } from './validators';
import { TOKEN_ASSET } from '@utils/currency';
import { USER } from './user';

export type CURRENCY = DecCoin;

export type CURRENCY_TOKEN = {
  token?: TOKEN_ASSET;
  ibc?: boolean;
  chain?: string;
} & CURRENCY;

export enum WALLET_TYPE {
  opera = 'opera',
  keplr = 'keplr',
  walletConnect = 'walletConnect',
  signX = 'signX',
}

export type WALLET = {
  walletType?: WALLET_TYPE;
  loading?: boolean;
  user?: USER;
  balances?: WALLET_BALANCES;
  delegations?: WALLET_DELEGATIONS;
  delegationRewards?: WALLET_DELEGATION_REWARDS;
  unbondingDelegations?: WALLET_UNBONDING;
};

export type WALLET_KEYS = 'balances' | 'delegations' | 'rewards' | 'unbonding';

export type WALLET_ASSETS = WALLET_BALANCES | WALLET_DELEGATIONS | WALLET_DELEGATION_REWARDS | WALLET_UNBONDING;

export type WALLET_BALANCES = {
  loading?: boolean;
  error?: string;
  data?: CURRENCY_TOKEN[];
};

export type WALLET_DELEGATIONS = {
  loading?: boolean;
  error?: string;
  data?: DELEGATION[];
};

export type WALLET_DELEGATION_REWARDS = {
  loading?: boolean;
  error?: string;
  data?: DELEGATION_REWARDS;
};

export type WALLET_UNBONDING = {
  loading?: boolean;
  error?: string;
  data?: UNBONDING_DELEGATION[];
};

export type TOKEN_BALANCE = {
  denom: string; // TODO: remove denom
  available: number;
  staked: number;
  undelegating: number;
  token: CURRENCY_TOKEN;
};
