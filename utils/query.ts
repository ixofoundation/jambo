import { DecCoin } from '@ixo/impactxclient-sdk/types/codegen/cosmos/base/v1beta1/coin';
import { createQueryClient } from '@ixo/impactxclient-sdk';

import { BLOCKCHAIN_RPC_URL } from '@constants/chains';
import { VALIDATOR_FILTER_KEYS as FILTERS } from '@constants/filters';
import { DELEGATION, VALIDATOR } from 'types/validators';
import { WALLET } from 'types/wallet';
import { filterValidators } from './filters';
import { DelegationResponse, Validator } from '@ixo/impactxclient-sdk/types/codegen/cosmos/staking/v1beta1/staking';

export type QUERY_CLIENT = Awaited<ReturnType<typeof createQueryClient>>;

export const initializeQueryClient = async (queryClient?: QUERY_CLIENT) => {
	if (queryClient) return queryClient;
	const client = await createQueryClient(BLOCKCHAIN_RPC_URL);
	return client;
};

export const queryAllBalances = async (queryClient: QUERY_CLIENT, address: string): Promise<DecCoin[]> => {
	let balances = [];
	try {
		const client = await initializeQueryClient(queryClient);
		const response = await client.cosmos.bank.v1beta1.allBalances({ address });
		balances = response.balances;
	} catch (error) {
		console.log('queryAllBalances', error);
		throw error;
	}
	return balances;
};

export const queryDelegatorDelegations = async (queryClient: QUERY_CLIENT, wallet: WALLET): Promise<DELEGATION[]> => {
	try {
		const client = await initializeQueryClient(queryClient);
		const { delegationResponses = [] } = await client.cosmos.staking.v1beta1.delegatorDelegations({
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
				const { rewards } = await client.cosmos.distribution.v1beta1.delegationRewards({
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
		const client = await initializeQueryClient(queryClient);
		const { validators = [] } = await client.cosmos.staking.v1beta1.validators({ status: 'BOND_STATUS_BONDED' });
		const delegatorDelegations = await queryDelegatorDelegations(client, wallet);
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
		newValidatorList = filterValidators(newValidatorList, FILTERS.VOTING_DESC, '');
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
