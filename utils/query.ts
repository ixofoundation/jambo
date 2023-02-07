import { DelegationResponse, Validator } from '@ixo/impactxclient-sdk/types/codegen/cosmos/staking/v1beta1/staking';
import { createQueryClient, customQueries } from '@ixo/impactxclient-sdk';

import { VALIDATOR_FILTER_KEYS as FILTERS } from '@constants/filters';
import { DELEGATION, VALIDATOR, VALIDATOR_FILTER_TYPE } from 'types/validators';
import { CURRENCY, WALLET, WALLET_BALANCE } from 'types/wallet';
import { QUERY_CLIENT } from 'types/query';
import { filterValidators } from './filters';

export const initializeQueryClient = async (blockchainRpcUrl: string) => {
	const client = await createQueryClient(blockchainRpcUrl);
	return client;
};

export const queryAllBalances = async (queryClient: QUERY_CLIENT, address: string): Promise<WALLET_BALANCE[]> => {
	try {
		const response = await queryClient.cosmos.bank.v1beta1.allBalances({ address });
		let balances = response.balances;
		balances = balances.map((balance: CURRENCY): WALLET_BALANCE => {
			const token = customQueries.currency.findTokenFromDenom(balance.denom);
			return { ...balance, token };
		});
		return balances;
	} catch (error) {
		console.error('queryAllBalances', error);
		throw error;
	}
};

export const queryDelegatorDelegations = async (queryClient: QUERY_CLIENT, wallet: WALLET): Promise<DELEGATION[]> => {
	try {
		const { delegationResponses = [] } = await queryClient.cosmos.staking.v1beta1.delegatorDelegations({
			delegatorAddr: wallet.user?.address ?? '',
		});
		const delegatorDelegations: DELEGATION[] = delegationResponses.map((delegation: DelegationResponse) => ({
			delegatorAddress: delegation?.delegation?.delegatorAddress ?? '',
			validatorAddress: delegation?.delegation?.validatorAddress ?? '',
			shares: Number(delegation?.delegation?.shares ?? 0),
			balance: {
				denom: delegation?.balance?.denom ?? '',
				amount: delegation?.balance?.amount ?? '0',
			},
		}));

		for (let i = 0; i < delegatorDelegations.length; i++) {
			try {
				const delegation = delegatorDelegations[i];
				const { rewards } = await queryClient.cosmos.distribution.v1beta1.delegationRewards({
					delegatorAddress: wallet.user?.address ?? '',
					validatorAddress: delegation.validatorAddress,
				});
				delegatorDelegations[i].rewards = rewards;
			} catch (error) {
				console.error('Failed to query delegation rewards:', error);
			}
		}

		return Promise.resolve(delegatorDelegations);
	} catch (error) {
		console.error(error);
		return Promise.resolve([]);
	}
};

export const queryValidators = async (queryClient: QUERY_CLIENT, wallet: WALLET) => {
	try {
		const { validators = [] } = await queryClient.cosmos.staking.v1beta1.validators({ status: 'BOND_STATUS_BONDED' });
		const delegatorDelegations = await queryDelegatorDelegations(queryClient, wallet);
		const totalTokens = validators.reduce((result: number, validator: any) => {
			return result + Number(validator.tokens || 0);
		}, 0);
		let newValidatorList: VALIDATOR[] = validators.map((validator: Validator) => {
			const validatorVotingPower = (
				(Number(validator.tokens) / Math.pow(10, 6) / (totalTokens / Math.pow(10, 6))) *
				100
			).toFixed(2);

			const delegation = delegatorDelegations.find(
				(delegation) => delegation.validatorAddress === validator.operatorAddress,
			);

			return {
				address: validator.operatorAddress,
				moniker: validator.description?.moniker ?? '',
				identity: validator.description?.identity ?? '',
				avatarUrl: null,
				description: validator.description?.details,
				commission: Number(validator.commission?.commissionRates?.rate ?? 0) / Math.pow(10, 16),
				votingPower: Number(validatorVotingPower),
				votingRank: 0,
				delegation: delegation ?? null,
			};
		});
		newValidatorList = filterValidators(newValidatorList, FILTERS.VOTING_POWER_RANKING as VALIDATOR_FILTER_TYPE, '');
		newValidatorList = newValidatorList.map((validator: VALIDATOR, index: number) => ({
			...validator,
			votingRank: index + 1,
		}));

		return newValidatorList ?? [];
	} catch (error) {
		console.error(error);
		return [];
	}
};
