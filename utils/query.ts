import { DelegationResponse, Validator } from '@ixo/impactxclient-sdk/types/codegen/cosmos/staking/v1beta1/staking';
import { createQueryClient, customQueries } from '@ixo/impactxclient-sdk';

import { VALIDATOR_FILTER_KEYS as FILTERS } from '@constants/filters';
import {
  DELEGATION,
  DELEGATION_REWARDS,
  UNBONDING_DELEGATION,
  VALIDATOR,
  VALIDATOR_FILTER_TYPE,
} from 'types/validators';
import { CURRENCY, WALLET_BALANCE } from 'types/wallet';
import { QUERY_CLIENT } from 'types/query';
import { filterValidators } from './filters';

export const initializeQueryClient = async (blockchainRpcUrl: string) => {
  const client = await createQueryClient(blockchainRpcUrl);
  return client;
};

export const queryAllBalances = async (queryClient: QUERY_CLIENT, address: string): Promise<WALLET_BALANCE[]> => {
  try {
    const response = await queryClient.cosmos.bank.v1beta1.allBalances({ address });
    let balances: WALLET_BALANCE[] = [];
    for (const balance of response.balances) {
      const isIbc = /^ibc\//i.test(balance.denom);
      if (isIbc) {
        const ibcToken = await customQueries.currency.findIbcTokenFromHash(queryClient, balance.denom);
        balances.push({ ...balance, ibc: isIbc, token: ibcToken.token });
      } else {
        const token = customQueries.currency.findTokenFromDenom(balance.denom);
        balances.push({ ...balance, ibc: isIbc, token });
      }
    }
    return balances.sort((a, b) => (a.ibc ? 1 : -1));
  } catch (error) {
    console.error('queryAllBalances::', error);
    return [];
  }
};

export const queryDelegatorDelegations = async (queryClient: QUERY_CLIENT, address: string): Promise<DELEGATION[]> => {
  try {
    const { delegationResponses = [] } = await queryClient.cosmos.staking.v1beta1.delegatorDelegations({
      delegatorAddr: address,
    });
    const delegatorDelegations: DELEGATION[] = delegationResponses.map((delegation: DelegationResponse) => ({
      delegatorAddress: delegation?.delegation?.delegatorAddress ?? '',
      validatorAddress: delegation?.delegation?.validatorAddress ?? '',
      shares: Number(delegation?.delegation?.shares ?? 0),
      balance: {
        denom: delegation?.balance?.denom ?? '',
        amount: delegation?.balance?.amount ?? '0',
        ibc: false,
        token: customQueries.currency.findTokenFromDenom(delegation?.balance?.denom ?? ''),
      },
    }));

    return Promise.resolve(delegatorDelegations);
  } catch (error) {
    console.error('queryDelegatorDelegations::', error);
    return [];
  }
};

export const queryDelegationTotalRewards = async (
  queryClient: QUERY_CLIENT,
  address: string,
): Promise<DELEGATION_REWARDS | undefined> => {
  try {
    const response = await queryClient.cosmos.distribution.v1beta1.delegationTotalRewards({
      delegatorAddress: address,
    });

    if (!response?.total?.length) return;

    const delegationTotalRewards = {
      total: response.total.map((total: CURRENCY) => ({
        amount: total.amount.slice(0, total.amount.length - 18),
        denom: total.denom,
      })),
      rewards: response.rewards.map((reward) => ({
        validatorAddress: reward.validatorAddress,
        rewards: reward.reward.map((r) => ({
          amount: r.amount.slice(0, r.amount.length - 18),
          denom: r.denom,
          ibc: false,
          token: customQueries.currency.findTokenFromDenom(r.denom ?? ''),
        })),
      })),
    };

    return delegationTotalRewards;
  } catch (error) {
    console.error('queryDelegationTotalRewards::', error);
    return;
  }
};

export const queryDelegatorUnbondingDelegations = async (
  queryClient: QUERY_CLIENT,
  address: string,
): Promise<UNBONDING_DELEGATION[]> => {
  try {
    const response = await queryClient.cosmos.staking.v1beta1.delegatorUnbondingDelegations({
      delegatorAddr: address,
    });
    const unbondingDelegations = response.unbondingResponses.map((unbondingDelegation) => ({
      delegatorAddress: unbondingDelegation.delegatorAddress,
      validatorAddress: unbondingDelegation.validatorAddress,
      entries: unbondingDelegation.entries.map((entry) => ({
        balance: Number(entry.balance ?? 0), // TODO: add staking token/CURRENCY_TOKEN here
        completionTime: Number(entry.completionTime?.seconds?.low ?? 0),
      })),
    }));
    return unbondingDelegations;
  } catch (error) {
    console.error('queryDelegatorUnbondingDelegations::', error);
    return [];
  }
};

export const queryValidators = async (queryClient: QUERY_CLIENT) => {
  try {
    const { validators = [] } = await queryClient.cosmos.staking.v1beta1.validators({ status: 'BOND_STATUS_BONDED' });
    const totalTokens = validators.reduce((result: number, validator: any) => {
      return result + Number(validator.tokens || 0);
    }, 0);
    let newValidatorList: VALIDATOR[] = validators.map((validator: Validator) => {
      const validatorVotingPower = (
        (Number(validator.tokens) / Math.pow(10, 6) / (totalTokens / Math.pow(10, 6))) *
        100
      ).toFixed(2);

      return {
        address: validator.operatorAddress,
        moniker: validator.description?.moniker ?? '',
        identity: validator.description?.identity ?? '',
        description: validator.description?.details,
        commission: Number(validator.commission?.commissionRates?.rate ?? 0) / Math.pow(10, 16),
        votingPower: Number(validatorVotingPower),
        votingRank: 0,
      };
    });
    newValidatorList = filterValidators(newValidatorList, FILTERS.VOTING_POWER_RANKING as VALIDATOR_FILTER_TYPE, '');
    newValidatorList = newValidatorList.map((validator: VALIDATOR, index: number) => ({
      ...validator,
      votingRank: index + 1,
    }));

    return newValidatorList ?? [];
  } catch (error) {
    console.error('queryValidators::', error);
    return [];
  }
};
