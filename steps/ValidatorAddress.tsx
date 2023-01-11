import { ChangeEvent, FC, FormEvent, useState, useEffect, useContext } from 'react';
import cls from 'classnames';

import utilsStyles from '@styles/utils.module.scss';
import styles from '@styles/stepsPages.module.scss';
import InputWithSufficIcon from '@components/InputWithSuffixIcon/InputWithSuffixIcon';
import ValidatorListItem from '@components/ValidatorListItem/ValidatorListItem';
import ValidatorCard from '@components/ValidatorCard/ValidatorCard';
import IconText from '@components/IconText/IconText';
import Header from '@components/Header/Header';
import Loader from '@components/loader/loader';
import Footer from '@components/Footer/Footer';
import FilterDesc from '@icons/filter_desc.svg';
import FilterAsc from '@icons/filter_asc.svg';
import SadFace from '@icons/sad_face.svg';
import Search from '@icons/search.svg';
import { VALIDATOR_FILTER_KEYS as FILTERS } from '@constants/filters';
import { VALIDATOR, ValidatorConfig } from 'types/validators';
import { filterValidators } from '@utils/filters';
import { StepDataType, STEPS } from 'types/steps';
import { WalletContext } from '@contexts/wallet';

type ValidatorAddressProps = {
	onSuccess: (data: StepDataType<STEPS.get_validator_address>) => void;
	onBack?: () => void;
	data?: StepDataType<STEPS.get_validator_address>;
	header?: string;
	config: ValidatorConfig;
};

const ValidatorAddress: FC<ValidatorAddressProps> = ({ onSuccess, onBack, header, config }) => {
	const [validatorsData, setValidatorsData] = useState<VALIDATOR[]>([]);
	const [validatorList, setValidatorList] = useState<VALIDATOR[]>([]);
	const [loading, setLoading] = useState<boolean>(true);
	const [search, setSearch] = useState<string>('');
	const [filter, setFilter] = useState<string>(FILTERS.VOTING_DESC);
	const [selectedValidator, setSelectedValidator] = useState<VALIDATOR | null>(null);
	const { updateValidators, validators } = useContext(WalletContext);

	useEffect(() => {
		if (validators?.length && config.delegatedValidatorsOnly) {
			setValidatorsData(validators.filter((validator: VALIDATOR) => !!validator.delegation?.shares) ?? []);
		} else {
			setValidatorsData(validators ?? []);
		}
		setLoading(false);
	}, [validators]);

	useEffect(() => {
		updateValidators();
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
				{loading ? (
					<Loader />
				) : !validatorList.length ? (
					<IconText text="You don't have any tokens delegated yet." Img={SadFace} imgSize={50} />
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
							return <ValidatorListItem key={validator.address} validator={validator} onClick={handleValidatorClick} />;
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
