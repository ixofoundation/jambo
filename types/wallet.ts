import { DecCoin } from '@ixo/impactxclient-sdk/types/codegen/cosmos/base/v1beta1/coin';
import { TOKEN_ASSET } from '@utils/currency';

import { USER } from './user';
import { DELEGATION, DELEGATION_REWARDS, UNBONDING_DELEGATION } from './validators';

export type CURRENCY = DecCoin;

export type WALLET_BALANCE = {
  token?: TOKEN_ASSET;
  ibc?: boolean;
} & CURRENCY;

export type CURRENCY_TOKEN = {
  token?: TOKEN_ASSET;
  ibc?: boolean;
} & CURRENCY;

export enum WALLET_TYPE {
  opera = 'opera',
  keplr = 'keplr',
  walletConnect = 'walletConnect',
}

export type WALLET = {
  walletType?: WALLET_TYPE;
  user?: USER;
  balances?: WALLET_BALANCES;
  delegations?: WALLET_DELEGATIONS;
  rewards?: WALLET_REWARDS;
  unbonding?: WALLET_UNBONDING;
};

export type WALLET_KEYS = 'balances' | 'delegations' | 'rewards' | 'unbonding';

export type WALLET_ASSETS = WALLET_BALANCES | WALLET_DELEGATIONS | WALLET_REWARDS | WALLET_UNBONDING;

export type WALLET_BALANCES = {
  loading?: boolean;
  error?: string;
  balances?: WALLET_BALANCE[];
};

export type WALLET_DELEGATIONS = {
  loading?: boolean;
  error?: string;
  delegations?: DELEGATION[];
};

export type WALLET_REWARDS = {
  loading?: boolean;
  error?: string;
  rewards?: DELEGATION_REWARDS;
};

export type WALLET_UNBONDING = {
  loading?: boolean;
  error?: string;
  unbonding?: UNBONDING_DELEGATION[];
};

export type TOKEN_BALANCE = {
  denom: string; // TODO: remove denom
  available: number;
  staked: number;
  undelegating: number;
  token: CURRENCY_TOKEN;
};
