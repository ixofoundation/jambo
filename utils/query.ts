import { DelegationResponse, Validator } from '@ixo/impactxclient-sdk/types/codegen/cosmos/staking/v1beta1/staking';
import { ProposalStatus } from '@ixo/impactxclient-sdk/types/codegen/cosmos/gov/v1beta1/gov';
import { cosmos, createQueryClient, customQueries } from '@ixo/impactxclient-sdk';
import { longify } from '@cosmjs/stargate/build/queryclient';
import { VALIDATOR_FILTER_KEYS as FILTERS } from '@constants/filters';
import { tokens } from '@constants/pools';
import { QUERY_CLIENT } from 'types/query';
import { TokenAmount, TokenSelect, TokenType } from 'types/swap';
import {
  DELEGATION,
  DELEGATION_REWARDS,
  UNBONDING_DELEGATION,
  VALIDATOR,
  VALIDATOR_FILTER_TYPE,
} from 'types/validators';
import { CURRENCY_TOKEN } from 'types/wallet';
import { filterValidators } from './filters';
import { TOKEN_ASSET } from './currency';
import { strToArray, uint8ArrayToStr } from './encoding';

export const initializeQueryClient = async (blockchainRpcUrl: string) => {
  const client = await createQueryClient(blockchainRpcUrl);
  return client;
};

export const queryApprovalVerification = async (
  queryClient: QUERY_CLIENT,
  owner: string,
  operator: string,
  address: string,
): Promise<boolean> => {
  try {
    const response = await queryClient.cosmwasm.wasm.v1.smartContractState({
      address,
      queryData: strToArray(
        JSON.stringify({
          is_approved_for_all: {
            owner,
            operator,
          },
        }),
      ),
    });

    return JSON.parse(uint8ArrayToStr(response.data)).approved;
  } catch (error) {
    console.error('queryApprovalVerification::', error);
    return false;
  }
};

export const queryOutputAmountByInputAmount = async (
  queryClient: QUERY_CLIENT,
  inputToken: TokenSelect,
  inputAmount: TokenAmount,
  address: string,
): Promise<string> => {
  try {
    const queryAmount = async (address: string, query: string) =>
      queryClient.cosmwasm.wasm.v1.smartContractState({
        address,
        queryData: strToArray(query),
      });

    switch (inputToken) {
      case TokenSelect.Token1155: {
        const query = { token1155_for_token2_price: { token1155_amount: inputAmount } };
        const response = await queryAmount(address, JSON.stringify(query));

        return JSON.parse(uint8ArrayToStr(response.data)).token2_amount;
      }
      case TokenSelect.Token2: {
        const query = { token2_for_token1155_price: { token2_amount: inputAmount } };
        const response = await queryAmount(address, JSON.stringify(query));

        return JSON.parse(uint8ArrayToStr(response.data)).token1155_amount;
      }
    }
  } catch (error) {
    console.error('queryOutputAmountByInputAmount::', error);
    return '0';
  }
};

export const queryTrxResult = async (queryClient: QUERY_CLIENT, trxHash: string) => {
  try {
    return queryClient.cosmos.tx.v1beta1.getTx({ hash: trxHash });
  } catch (error) {
    console.error('queryTrxResult::', error);
    return;
  }
};

export const queryTokenBalances = async (
  queryClient: QUERY_CLIENT,
  chain: string,
  address: string,
): Promise<CURRENCY_TOKEN[]> => {
  try {
    const balances: CURRENCY_TOKEN[] = [];
    const batches: Map<string, string> = new Map();
    for (const [denom, token] of tokens) {
      switch (token.type) {
        case TokenType.Cw1155: {
          const ownerTokensQuery = { tokens: { owner: address } };
          const ownerTokensResponse = await queryClient.cosmwasm.wasm.v1.smartContractState({
            address: token.address!,
            queryData: strToArray(JSON.stringify(ownerTokensQuery)),
          });
          const ownerTokenIds: string[] = JSON.parse(uint8ArrayToStr(ownerTokensResponse.data)).tokens ?? [];

          const ownerBalancesQuery = {
            batch_balance: {
              owner: address,
              token_ids: ownerTokenIds,
            },
          };
          const ownerBalancesResponse = await queryClient.cosmwasm.wasm.v1.smartContractState({
            address: token.address!,
            queryData: strToArray(JSON.stringify(ownerBalancesQuery)),
          });
          const ownerBalances = JSON.parse(uint8ArrayToStr(ownerBalancesResponse.data)).balances;
          const totalBalance = !ownerBalances.length
            ? 0
            : ownerBalances.reduce((prev: string, current: string) => Number(prev) + Number(current));

          for (const [index, tokenId] of ownerTokenIds.entries()) {
            batches.set(tokenId, ownerBalances[index].toString());
          }

          balances.push({ denom, amount: totalBalance.toString(), batches, ibc: false, chain });
          break;
        }
        case TokenType.Cw20: {
          const query = { balance: { address } };
          const response = await queryClient.cosmwasm.wasm.v1.smartContractState({
            address: token.address!,
            queryData: strToArray(JSON.stringify(query)),
          });

          balances.push({ denom, amount: JSON.parse(uint8ArrayToStr(response.data)).balance, ibc: false, chain });
          break;
        }
      }
    }

    return balances;
  } catch (error) {
    console.error('queryTokenBalances::', error);
    return [];
  }
};

export const queryAllBalances = async (
  queryClient: QUERY_CLIENT,
  chain: string,
  address: string,
): Promise<CURRENCY_TOKEN[]> => {
  try {
    const response = await queryClient.cosmos.bank.v1beta1.allBalances({ address });
    let balances: CURRENCY_TOKEN[] = [];
    for (const balance of response.balances) {
      const isIbc = /^ibc\//i.test(balance.denom);
      if (isIbc) {
        const ibcToken = await customQueries.currency.findIbcTokenFromHash(queryClient, balance.denom);
        balances.push({ ...balance, ibc: isIbc, token: ibcToken.token, chain });
      } else {
        const token = customQueries.currency.findTokenFromDenom(balance.denom);
        balances.push({ ...balance, ibc: isIbc, token, chain });
      }
    }
    return balances.sort((a, b) => (a.ibc ? 1 : -1));
  } catch (error) {
    console.error('queryAllBalances::', error);
    return [];
  }
};

export const queryDelegatorDelegations = async (
  queryClient: QUERY_CLIENT,
  chain: string,
  address: string,
  stakeCurrency: TOKEN_ASSET,
): Promise<DELEGATION[]> => {
  try {
    const { delegationResponses = [] } = await queryClient.cosmos.staking.v1beta1.delegatorDelegations({
      delegatorAddr: address,
    });
    const delegatorDelegations: DELEGATION[] = delegationResponses.map((delegation: DelegationResponse) => ({
      delegatorAddress: delegation?.delegation?.delegatorAddress ?? '',
      validatorAddress: delegation?.delegation?.validatorAddress ?? '',
      shares: Number(delegation?.delegation?.shares ?? 0),
      balance: {
        denom: delegation?.balance?.denom ?? stakeCurrency.coinMinimalDenom ?? '',
        amount: delegation?.balance?.amount ?? '0',
        ibc: false,
        chain,
        token: stakeCurrency,
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
  chain: string,
  address: string,
  stakeCurrency: TOKEN_ASSET,
): Promise<DELEGATION_REWARDS | undefined> => {
  try {
    const response = await queryClient.cosmos.distribution.v1beta1.delegationTotalRewards({
      delegatorAddress: address,
    });
    if (!response?.total?.length) return;
    const totalRewards = response.total.find((total) => total.denom === stakeCurrency.coinMinimalDenom);
    const delegationTotalRewards = {
      total: totalRewards
        ? {
            amount: totalRewards.amount.slice(0, totalRewards.amount.length - 18),
            denom: totalRewards.denom,
            ibc: false,
            chain,
            token: stakeCurrency,
          }
        : undefined,
      // total: response.total.map(
      //   (total: CURRENCY): CURRENCY_TOKEN => ({
      //     amount: total.amount.slice(0, total.amount.length - 18),
      //     denom: total.denom,
      //     ibc: false,
      //     chain,
      //     token: stakeCurrency,
      //   }),
      // ),
      rewards: response.rewards.map((reward) => {
        const delegationReward = reward.reward.find((reward) => reward.denom === stakeCurrency.coinMinimalDenom);

        return {
          validatorAddress: reward.validatorAddress,
          rewards: delegationReward
            ? {
                amount: delegationReward.amount.slice(0, delegationReward.amount.length - 18),
                denom: delegationReward.denom ?? stakeCurrency.coinMinimalDenom,
                ibc: false,
                chain,
                token: stakeCurrency,
              }
            : undefined,
        };
      }),
      // rewards: response.rewards.map((reward) => ({
      //   validatorAddress: reward.validatorAddress,
      //   rewards: reward.reward.map((r) => ({
      //     amount: r.amount.slice(0, r.amount.length - 18),
      //     denom: r.denom ?? stakeCurrency.coinMinimalDenom,
      //     ibc: false,
      //     chain,
      //     token: stakeCurrency,
      //   })),
      // })),
    };

    return delegationTotalRewards;
  } catch (error) {
    console.error('queryDelegationTotalRewards::', error);
    return;
  }
};

export const queryDelegatorUnbondingDelegations = async (
  queryClient: QUERY_CLIENT,
  chain: string,
  address: string,
  stakeCurrency: TOKEN_ASSET,
): Promise<UNBONDING_DELEGATION[]> => {
  try {
    const response = await queryClient.cosmos.staking.v1beta1.delegatorUnbondingDelegations({
      delegatorAddr: address,
    });
    const unbondingDelegations = response.unbondingResponses.map(
      (unbondingDelegation): UNBONDING_DELEGATION => ({
        delegatorAddress: unbondingDelegation.delegatorAddress,
        validatorAddress: unbondingDelegation.validatorAddress,
        entries: unbondingDelegation.entries.map((entry) => ({
          completionTime: Number(entry.completionTime?.seconds?.low ?? 0),
          // balance: Number(entry.balance ?? 0), // TODO: add staking token/CURRENCY_TOKEN here
          balance: {
            amount: entry.balance ?? '0',
            denom: stakeCurrency.coinMinimalDenom,
            ibc: false,
            chain,
            token: stakeCurrency,
          },
        })),
      }),
    );
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

export const queryProposals = async (
  queryClient: QUERY_CLIENT,
  proposalStatus: ProposalStatus,
  voter: string,
  depositor: string,
  offset = 0,
  limit: 50,
) => {
  const result = await queryClient.cosmos.gov.v1beta1.proposals({
    proposalStatus: proposalStatus ?? cosmos.gov.v1beta1.ProposalStatus.PROPOSAL_STATUS_UNSPECIFIED,
    voter: voter ?? '',
    depositor: depositor ?? '',
    pagination: cosmos.base.query.v1beta1.PageRequest.fromPartial({
      limit: longify(limit),
      offset: longify(offset),
      reverse: true,
    }),
  });

  return result?.proposals ?? [];
};

export const queryVote = async (queryClient: QUERY_CLIENT, address: string, proposalId: number) => {
  try {
    const { vote } = await queryClient.cosmos.gov.v1beta1.vote({ voter: address, proposalId: longify(proposalId) });
    return vote;
  } catch (error) {
    console.error('queryVote::', error);
    return;
  }
};

export const queryGovParams = async (queryClient: QUERY_CLIENT, paramsType: 'voting' | 'tallying' | 'deposit') => {
  try {
    const params = await queryClient.cosmos.gov.v1beta1.params({ paramsType });
    return params;
  } catch (error) {
    console.error('queryGovParams::', error);
    return;
  }
};
