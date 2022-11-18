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
import { VALIDATOR } from 'types/validators';
import ValidatorListItem from '@components/validator-list-item/validator-list-item';
// import { cosmos } from '@ixo/impactxclient-sdk';

type ValidatorAddressProps = {
	onSuccess: (data: StepDataType<STEPS.get_validator_address>) => void;
	onBack?: () => void;
	data?: StepDataType<STEPS.get_validator_address>;
	header?: string;
};

const FILTERS = {
	VOTING_ASC: 'voting_asc',
	VOTING_DESC: 'voting_desc',
	COMMISSION_ASC: 'commission_asc',
	COMMISSION_DESC: 'commission_desc',
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

	if (filter === FILTERS.VOTING_ASC) {
		return validatorsToFilter.sort((a: VALIDATOR, b: VALIDATOR) =>
			a.votingPower !== b.votingPower ? (a.votingPower > b.votingPower ? 1 : -1) : a.commission > b.commission ? 1 : -1,
		);
	}
	if (filter === FILTERS.VOTING_DESC) {
		return validatorsToFilter.sort((a: VALIDATOR, b: VALIDATOR) =>
			a.votingPower !== b.votingPower ? (a.votingPower > b.votingPower ? -1 : 1) : a.commission > b.commission ? -1 : 1,
		);
	}
	if (filter === FILTERS.COMMISSION_ASC) {
		return validatorsToFilter.sort((a: VALIDATOR, b: VALIDATOR) =>
			a.commission !== b.commission ? (a.commission > b.commission ? 1 : -1) : a.votingPower > b.votingPower ? 1 : -1,
		);
	}
	if (filter === FILTERS.COMMISSION_DESC) {
		return validatorsToFilter.sort((a: VALIDATOR, b: VALIDATOR) =>
			a.commission !== b.commission ? (a.commission > b.commission ? -1 : 1) : a.votingPower > b.votingPower ? -1 : 1,
		);
	}

	console.error(`Invalid filter provided to sort validators - ${filter}`);
	return validatorsToFilter;
};

const ValidatorAddress: FC<ValidatorAddressProps> = ({ onSuccess, onBack, data, header }) => {
	const [validatorsData, setValidatorsData] = useState<VALIDATOR[]>([]);
	const [validatorList, setValidatorList] = useState<VALIDATOR[]>([]);
	const [search, setSearch] = useState<string>('');
	const [filter, setFilter] = useState<string>(FILTERS.VOTING_DESC);
	const [selectedValidator, setSelectedValidator] = useState<VALIDATOR | null>(null);
	const { queryClient } = useContext(WalletContext);

	const fetchValidators = async () => {
		try {
			if (!queryClient) {
				alert('No query client');
			}

			const { validators = [] } = await queryClient.cosmos.staking.v1beta1.validators({ status: 'BOND_STATUS_BONDED' });
			const totalTokens = validators.reduce((result: number, validator: any) => {
				return result + Number(validator.tokens || 0);
			}, 0);

			let newValidatorList = validators.map((validator: any) => {
				// const avatarUrl = await validatorAvatarUrl(val.description.identity);

				const validatorVotingPower = (
					(Number(validator.tokens) / Math.pow(10, 6) / (totalTokens / Math.pow(10, 6))) *
					100
				).toFixed(2);

				return {
					address: validator.operatorAddress,
					moniker: validator.description.moniker,
					identity: validator.description.identity,
					avatarUrl: null,
					description: validator.description.details,
					commission: validator.commission.commissionRates.rate / 10000000000000000,
					votingPower: validatorVotingPower,
					votingRank: 0,
				};
			});

			newValidatorList = filterValidators(newValidatorList, FILTERS.VOTING_DESC, '');

			newValidatorList = newValidatorList.map((validator: VALIDATOR, index: number) => ({
				...validator,
				votingRank: index + 1,
			}));

			setValidatorsData(newValidatorList ?? []);
		} catch (error) {
			console.error(error);
		}
	};

	useEffect(() => {
		fetchValidators();

		// TODO: Check delegated validators
		// (async () => {
		// 	try {
		// 		const res = await queryClient.
		// 	} catch (error) {
		// 		console.error(error)
		// 	}
		// })()
	}, []);

	useEffect(() => {
		setValidatorList(filterValidators(validatorsData, filter, search));
	}, [validatorsData, search]);

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

	// const handleAvatarFetched = (validatorIndex: number) => (avatarUrl: string) => {
	// 	setValidatorsData(prevState => {
	// 		const newState = [...prevState.]
	// 	})
	// }

	return (
		<>
			{selectedValidator?.address ? (
				<>
					<Header pageTitle="VAlidator details" header={header} />

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
			) : (
				<>
					<Header pageTitle="Choose validator" header={header} />

					<main className={cls(utilsStyles.main, utilsStyles.columnJustifyCenter, styles.stepContainer)}>
						<div className={utilsStyles.spacer} />
						<form className={styles.stepsForm} onSubmit={handleSubmit} autoComplete="none">
							<p>Choose validator</p>
							<InputWithSufficIcon name="address" onChange={handleChange} value={search} Icon={Search} />

							<div className={utilsStyles.spacer} />

							<div className={styles.filtersWrapper}>
								<button
									className={`${styles.filterButton} ${
										[FILTERS.VOTING_ASC, FILTERS.VOTING_DESC].includes(filter) ? styles.activeFilterButton : ''
									}`}
									onClick={handleFilterClick(filter === FILTERS.VOTING_DESC ? FILTERS.VOTING_ASC : FILTERS.VOTING_DESC)}
								>
									Voting power {filter === FILTERS.VOTING_ASC ? <FilterAsc /> : <FilterDesc />}
								</button>
								<button
									className={`${styles.filterButton} ${
										[FILTERS.COMMISSION_ASC, FILTERS.COMMISSION_DESC].includes(filter) ? styles.activeFilterButton : ''
									}`}
									onClick={handleFilterClick(
										filter === FILTERS.COMMISSION_DESC ? FILTERS.COMMISSION_ASC : FILTERS.COMMISSION_DESC,
									)}
								>
									Commission {filter === FILTERS.COMMISSION_ASC ? <FilterAsc /> : <FilterDesc />}
								</button>
							</div>

							{validatorList.map((validator: any) => {
								return (
									<ValidatorListItem
										key={validator.address}
										validator={validator}
										onClick={handleValidatorClick}
										onAvatarFetched={console.log}
									/>
								);
							})}
						</form>
						<div className={utilsStyles.spacer} />

						<Footer
							onBack={onBack}
							onBackUrl={onBack ? undefined : ''}
							onCorrect={formIsValid() ? () => handleSubmit(null) : null}
						/>
					</main>
				</>
			)}
		</>
	);
};

export default ValidatorAddress;
