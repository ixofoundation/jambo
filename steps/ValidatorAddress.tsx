// Page not finished please dont use yet

import { ChangeEvent, FC, FormEvent, useState, useEffect, useContext } from 'react';
import cls from 'classnames';

import utilsStyles from '@styles/utils.module.scss';
import styles from '@styles/stepsPages.module.scss';
import Header from '@components/header/header';
import Footer from '@components/footer/footer';
import Search from '@icons/search.svg';
import FilterAsc from '@icons/filter_asc.svg';
import FilterDesc from '@icons/filter_desc.svg';
import InputWithSufficIcon from '@components/input-with-suffix-icon/input-with-suffix-icon';
import { StepDataType, STEPS } from 'types/steps';
// import EmptySteps from './empty';
import { WalletContext } from '@contexts/wallet';
import ValidatorCard from '@components/validator-card/validator-card';
import { DELEGATION, VALIDATOR, ValidatorConfig } from 'types/validators';
import ValidatorListItem from '@components/validator-list-item/validator-list-item';
import { VALIDATOR_FILTERS } from '@utils/filters';
import { VALIDATOR_FILTER_KEYS as FILTERS } from '@constants/filters';
import Loader from '@components/loader/loader';

// const DUMMY_DATA = [
// 	{
// 		address: 'ixovaloper1c2p6gt94zklklz63q6zv4p5a665myng7y47g8j',
// 		moniker: 'ixo-tester',
// 		identity: '',
// 		avatarUrl: null,
// 		description: '',
// 		commission: 10,
// 		votingPower: '99.87',
// 		votingRank: 1,
// 		delegation: null,
// 	},
// 	{
// 		address: 'ixovaloper1skya94ncr7u2276dxnkxrsuwwhrwd9sze7wg30',
// 		moniker: 'Forbole',
// 		identity: '2861F5EE06627224',
// 		avatarUrl: null,
// 		description: 'Co-building the Interchain',
// 		commission: 10,
// 		votingPower: '0.13',
// 		votingRank: 2,
// 		delegation: null,
// 	},
// ];

type ValidatorAddressProps = {
	onSuccess: (data: StepDataType<STEPS.get_validator_address>) => void;
	onBack?: () => void;
	data?: StepDataType<STEPS.get_validator_address>;
	header?: string;
	config: ValidatorConfig;
};

const filterValidators = (validators: VALIDATOR[], filter: string, search: string) => {
	if (!validators?.length) {
		return validators;
	}

	let validatorsToFilter = validators;

	if (search?.length) {
		const searchTerm = search.toLowerCase();
		validatorsToFilter = validatorsToFilter.filter((validator) =>
			validator.moniker?.toLowerCase()?.includes(searchTerm),
		);
	}

	return validatorsToFilter.sort(VALIDATOR_FILTERS[filter]);
};

const ValidatorAddress: FC<ValidatorAddressProps> = ({ onSuccess, onBack, data, header, config }) => {
	const [validatorsData, setValidatorsData] = useState<VALIDATOR[]>([]);
	const [validatorList, setValidatorList] = useState<VALIDATOR[]>([]);
	const [search, setSearch] = useState<string>('');
	const [filter, setFilter] = useState<string>(FILTERS.VOTING_DESC);
	const [selectedValidator, setSelectedValidator] = useState<VALIDATOR | null>(null);
	const { queryClient, wallet } = useContext(WalletContext);

	const fetchDelegatorDelegations = async () => {
		try {
			const { delegationResponses = [] } = await queryClient.cosmos.staking.v1beta1.delegatorDelegations({
				delegatorAddr: wallet.user?.address ?? '',
			});

			const delegatorDelegations: DELEGATION[] = delegationResponses.map((delegation: any) => ({
				delegatorAddress: delegation.delegation.delegatorAddress,
				validatorAddress: delegation.delegation.validatorAddress,
				shares: Number(delegation.delegation.shares || 0),
				balance: {
					denom: delegation.balance.denom,
					amount: Number(delegation.balance.amount || 0),
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
					// const delegatorWithdrawAddress = await queryClient.cosmos.distribution.v1beta1.delegatorWithdrawAddress({
					// 	delegatorAddress: wallet.user?.address ?? '',
					// 	validatorAddress: delegation.validatorAddress,
					// });
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

	const fetchValidators = async () => {
		try {
			if (!queryClient) {
				alert('No query client');
			}

			const { validators = [] } = await queryClient.cosmos.staking.v1beta1.validators({ status: 'BOND_STATUS_BONDED' });
			const delegatorDelegations = await fetchDelegatorDelegations();
			const totalTokens = validators.reduce((result: number, validator: any) => {
				return result + Number(validator.tokens || 0);
			}, 0);

			let newValidatorList = validators.map((validator: any) => {
				const validatorVotingPower = (
					(Number(validator.tokens) / Math.pow(10, 6) / (totalTokens / Math.pow(10, 6))) *
					100
				).toFixed(2);

				const delegation = delegatorDelegations.find(
					(delegation) => delegation.validatorAddress === validator.operatorAddress,
				);

				return {
					address: validator.operatorAddress,
					moniker: validator.description.moniker,
					identity: validator.description.identity,
					avatarUrl: null,
					description: validator.description.details,
					commission: validator.commission.commissionRates.rate / 10000000000000000,
					votingPower: validatorVotingPower,
					votingRank: 0,
					delegation: delegation ?? null,
				};
			});

			// newValidatorList = newValidatorList.concat(DUMMY_DATA); // TODO: remove this concat
			newValidatorList = filterValidators(newValidatorList, FILTERS.VOTING_DESC, '');
			newValidatorList = newValidatorList.map((validator: VALIDATOR, index: number) => ({
				...validator,
				votingRank: index + 1,
			}));

			if (config.delegatedValidatorsOnly) {
				newValidatorList = newValidatorList.filter((validator: VALIDATOR) => !!validator.delegation?.shares);
			}

			setValidatorsData(newValidatorList ?? []);
		} catch (error) {
			console.error(error);
		}
	};

	useEffect(() => {
		fetchValidators();
	}, []);

	useEffect(() => {
		setValidatorList(filterValidators(validatorsData, filter, search));
	}, [validatorsData, search]);

	useEffect(() => {
		if (!config.showValidatorDetails && formIsValid()) {
			handleSubmit(null);
		}
	}, [selectedValidator]);

	const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
		setSearch(event.target.value);
	};

	const formIsValid = () => selectedValidator?.address?.length;

	const handleSubmit = (event: FormEvent<HTMLFormElement> | null) => {
		event?.preventDefault();
		if (!formIsValid()) return alert('A validator must be selected');
		onSuccess({ validator: selectedValidator as VALIDATOR });
	};

	const handleValidatorClick = (validator: VALIDATOR) => () => {
		setSelectedValidator(validator);
	};

	const handleFilterClick = (filterType: string) => (event: any) => {
		event?.preventDefault();
		setFilter(filterType);
		setValidatorList(filterValidators(validatorsData, filterType, search));
	};

	const unselectValidator = () => {
		setSelectedValidator(null);
	};

	const handleAvatarFetched = (validatorIndex: number) => (avatarUrl: string) => {
		setValidatorsData((prevState: VALIDATOR[]) => [
			...prevState.slice(0, validatorIndex),
			{ ...prevState[validatorIndex], avatarUrl },
			...prevState.slice(validatorIndex + 1),
		]);
	};

	if (config.showValidatorDetails && selectedValidator?.address)
		return (
			<>
				<Header pageTitle="Validator details" header={header} />

				<main className={cls(utilsStyles.main, utilsStyles.columnJustifyCenter, styles.stepContainer)}>
					<div className={utilsStyles.spacer} />
					<form className={styles.stepsForm} onSubmit={handleSubmit} autoComplete="none">
						<ValidatorCard validator={selectedValidator} />
					</form>
					<div className={utilsStyles.spacer} />

					<Footer
						onBack={unselectValidator}
						onBackUrl={onBack ? undefined : ''}
						onCorrect={formIsValid() ? () => handleSubmit(null) : null}
					/>
				</main>
			</>
		);

	return (
		<>
			<Header pageTitle={config.pageTitle} header={header} />

			<main className={cls(utilsStyles.main, utilsStyles.columnJustifyCenter, styles.stepContainer)}>
				<div className={utilsStyles.spacer} />
				{!validatorsData.length ? (
					<Loader />
				) : (
					<form className={styles.stepsForm} onSubmit={handleSubmit} autoComplete="none">
						<p>{config.label}</p>
						{config.allowFilters && (
							<>
								<InputWithSufficIcon name="address" onChange={handleChange} value={search} Icon={Search} />

								<div className={utilsStyles.spacer} />

								<div className={styles.filtersWrapper}>
									<button
										className={`${styles.filterButton} ${
											[FILTERS.VOTING_ASC, FILTERS.VOTING_DESC].includes(filter) ? styles.activeFilterButton : ''
										}`}
										onClick={handleFilterClick(
											filter === FILTERS.VOTING_DESC ? FILTERS.VOTING_ASC : FILTERS.VOTING_DESC,
										)}
									>
										Voting power {filter === FILTERS.VOTING_ASC ? <FilterAsc /> : <FilterDesc />}
									</button>
									<button
										className={`${styles.filterButton} ${
											[FILTERS.COMMISSION_ASC, FILTERS.COMMISSION_DESC].includes(filter)
												? styles.activeFilterButton
												: ''
										}`}
										onClick={handleFilterClick(
											filter === FILTERS.COMMISSION_DESC ? FILTERS.COMMISSION_ASC : FILTERS.COMMISSION_DESC,
										)}
									>
										Commission {filter === FILTERS.COMMISSION_ASC ? <FilterAsc /> : <FilterDesc />}
									</button>
								</div>
							</>
						)}

						{validatorList.map((validator: any, index: number) => {
							return (
								<ValidatorListItem
									key={validator.address}
									validator={validator}
									onClick={handleValidatorClick}
									onAvatarFetched={handleAvatarFetched(index)}
								/>
							);
						})}
					</form>
				)}
				<div className={utilsStyles.spacer} />

				<Footer
					onBack={onBack}
					onBackUrl={onBack ? undefined : ''}
					onCorrect={formIsValid() ? () => handleSubmit(null) : null}
				/>
			</main>
		</>
	);
};

export default ValidatorAddress;
