// A file to combine all wallet types methods into one callback function
import { ChainInfo } from '@keplr-wallet/types';

import { TRX_FEE_OPTION, TRX_MSG } from 'types/transactions';
import { KEPLR_CHAIN_INFO_TYPE } from 'types/chain';
import { TOKEN_BALANCE, WALLET, WALLET_TYPE, CURRENCY_TOKEN } from 'types/wallet';
import { USER } from 'types/user';
import { initializeWC, WCBroadCastMessage } from './walletConnect';
import { initializeKeplr, keplrBroadCastMessage } from './keplr';
import { initializeOpera, operaBroadCastMessage } from './opera';
import { getFeeDenom, TOKEN_ASSET } from './currency';
import { DELEGATION, UNBONDING_DELEGATION } from 'types/validators';
import { sumArray } from './misc';
import { initializeSignX, signXBroadCastMessage } from './signX';

// TODO: add address regex validations
export const shortenAddress = (address: string) =>
  (address?.length && address.length > 19 ? address.slice(0, 12).concat('...').concat(address.slice(-7)) : address) ??
  '';

// TODO: provide denom as 5th param to only group for the denom
export const groupWalletAssets = (
  balances: CURRENCY_TOKEN[],
  delegations: DELEGATION[],
  unbondingDelegations: UNBONDING_DELEGATION[],
): TOKEN_BALANCE[] => {
  const assets = new Map<string, TOKEN_BALANCE>();
  for (const balance of balances) {
    assets.set(balance.denom, {
      denom: balance.denom,
      available: Number(balance.amount ?? 0),
      staked: 0,
      undelegating: 0,
      token: balance,
    });
  }
  for (const delegation of delegations) {
    const asset = assets.get(delegation.balance.denom);
    assets.set(
      delegation.balance.denom,
      !!asset
        ? { ...asset, staked: Number(delegation.balance.amount ?? 0) + asset.staked }
        : {
            denom: delegation.balance.denom,
            available: 0,
            staked: Number(delegation.balance.amount ?? 0),
            undelegating: 0,
            token: {
              ...delegation.balance,
              amount: '0',
            },
          },
    );
  }
  for (const unbondingDelegation of unbondingDelegations) {
    const asset = assets.get(unbondingDelegation.entries[0].balance?.denom);
    assets.set(
      unbondingDelegation.entries[0].balance?.denom,
      asset
        ? {
            ...asset,
            undelegating:
              asset.undelegating + sumArray(unbondingDelegation.entries.map((x) => Number(x.balance.amount ?? 0))),
          }
        : {
            denom: unbondingDelegation.entries[0].balance?.denom,
            available: 0,
            staked: 0,
            undelegating: sumArray(unbondingDelegation.entries.map((x) => Number(x.balance))),
            token: {
              amount: '0',
              denom: unbondingDelegation.entries[0].balance?.denom,
              ibc: false,
              token: unbondingDelegation.entries[0].balance?.token,
            },
          },
    );
  }
  return Array.from(assets.values());
};

export const initializeWallet = async (
  walletType: WALLET_TYPE | undefined,
  chain: KEPLR_CHAIN_INFO_TYPE,
  walletUser?: USER,
): Promise<USER | undefined> => {
  if (!chain) return;
  switch (walletType) {
    case WALLET_TYPE.keplr:
      return await initializeKeplr(chain);
    case WALLET_TYPE.opera:
      return await initializeOpera(chain);
    case WALLET_TYPE.walletConnect:
      return await initializeWC(chain);
    case WALLET_TYPE.signX:
      return await initializeSignX(chain, walletUser);
    default:
      return;
  }
};

export const broadCastMessages = async (
  wallet: WALLET,
  msgs: TRX_MSG[],
  memo: string | undefined,
  fee: TRX_FEE_OPTION,
  suggestedFeeDenom: string,
  chain: KEPLR_CHAIN_INFO_TYPE,
): Promise<string | null> => {
  if (!chain) return null;
  const feeDenom = getFeeDenom(suggestedFeeDenom, chain.feeCurrencies as TOKEN_ASSET[]);
  switch (wallet.walletType) {
    case WALLET_TYPE.keplr:
      return await keplrBroadCastMessage(msgs, memo, fee, feeDenom, chain);
    case WALLET_TYPE.opera:
      return await operaBroadCastMessage(msgs, memo, fee, feeDenom, chain);
    case WALLET_TYPE.walletConnect:
      return await WCBroadCastMessage(msgs, memo, fee, feeDenom, chain);
    case WALLET_TYPE.signX:
      return await signXBroadCastMessage(msgs, memo, fee, feeDenom, chain, wallet);
    default:
      return null;
  }
};
