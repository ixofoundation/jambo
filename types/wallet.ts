import { DecCoin } from '@ixo/impactxclient-sdk/types/codegen/cosmos/base/v1beta1/coin';

import { USER } from './user';

export type CURRENCY = DecCoin;

export enum WALLET_TYPE {
  signX = 'signX',
}

export type WALLET = {
  walletType?: WALLET_TYPE;
  loading?: boolean;
  user?: USER;
};
