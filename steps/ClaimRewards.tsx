import { FC, useState, useEffect, useContext } from 'react';
import cls from 'classnames';

import utilsStyles from '@styles/utils.module.scss';
import styles from '@styles/stepsPages.module.scss';
import ValidatorListItem from '@components/ValidatorListItem/ValidatorListItem';
import IconText from '@components/IconText/IconText';
import Header from '@components/Header/Header';
import Loader from '@components/Loader/loader';
import Footer from '@components/Footer/Footer';
import SadFace from '@icons/sad_face.svg';
import Success from '@icons/success.svg';
import { VALIDATOR_FILTER_KEYS as FILTERS } from '@constants/filters';
import { defaultTrxFeeOption, generateWithdrawRewardTrx } from '@utils/transactions';
import { broadCastMessages } from '@utils/wallets';
import { filterValidators } from '@utils/filters';
import { WalletContext } from '@contexts/wallet';
import { ReviewStepsTypes, StepDataType, STEPS } from 'types/steps';
import { VALIDATOR } from 'types/validators';
import { TRX_MSG } from 'types/transactions';

type ValidatorAddressProps = {
	onSuccess: (data: StepDataType<STEPS.review_and_sign>) => void;
	onBack?: () => void;
	data?: StepDataType<STEPS.get_validator_address>;
	header?: string;
	message: ReviewStepsTypes;
};

const calculateAccumulatedRewards = (validators: VALIDATOR[]) => {
	let total = 0;
	validators.forEach((validator: VALIDATOR) => {
		if (validator.delegation?.rewards?.length) {
			total += Number(validator.delegation.rewards[0].amount ?? 0) / Math.pow(10, 6);
		}
	});
	return Number(total).toFixed(2);
};

const ClaimRewards: FC<ValidatorAddressProps> = ({ onSuccess, onBack, header, message }) => {
	const [validatorList, setValidatorList] = useState<VALIDATOR[]>([]);
	const [success, setSuccess] = useState(false);
	const [loading, setLoading] = useState(true);
	const [rewards, setRewards] = useState<string>();
	const { wallet, updateValidators, validators } = useContext(WalletContext);

	useEffect(() => {
		if (validators?.length) {
			const newValidatorList = validators.filter((validator: VALIDATOR) => !!validator.delegation?.shares) ?? [];
			setValidatorList(filterValidators(newValidatorList, FILTERS.VOTING_DESC, ''));
			setRewards(calculateAccumulatedRewards(newValidatorList));
		}
		setLoading(false);
	}, [validators]);

	useEffect(() => {
		updateValidators();
	}, []);

	const signTX = async (): Promise<void> => {
		if (!validatorList) return;
		setLoading(true);
		const trxs: TRX_MSG[] = validatorList.map((validator) =>
			generateWithdrawRewardTrx({
				delegatorAddress: wallet.user!.address,
				validatorAddress: validator.address,
			}),
		);
		const hash = await broadCastMessages(wallet, trxs, undefined, defaultTrxFeeOption);
		if (hash) setSuccess(true);

		console.table(trxs);

		setLoading(false);
	};

	return (
		<>
			<Header pageTitle="Claim rewards" header={header} />

			<main className={cls(utilsStyles.main, utilsStyles.columnJustifyCenter, styles.stepContainer)}>
				{loading ? (
					<Loader />
				) : success ? (
					<IconText text="transaction successful!" Img={Success} imgSize={50} />
				) : message === STEPS.distribution_MsgWithdrawDelegatorReward ? (
					validatorList?.length ? (
						<form className={styles.stepsForm} autoComplete="none">
							<p>Your delegations</p>
							{validatorList.map((validator: any, index: number) => {
								return <ValidatorListItem key={validator.address} validator={validator} />;
							})}
							<div className={utilsStyles.spacer} />
							<p>Combined Rewards</p>
							<p className={styles.rewardListItem}>{rewards} IXO</p>
							<div className={utilsStyles.spacer} />
							<p>Claim?</p>
						</form>
					) : (
						<IconText text="You don't have any tokens delegated yet." Img={SadFace} imgSize={50} />
					)
				) : (
					<p>Unsupported review type</p>
				)}
				<Footer
					onBack={loading || success ? null : onBack}
					onBackUrl={onBack ? undefined : ''}
					onCorrect={loading ? null : success ? () => onSuccess({ done: true }) : signTX}
				/>
			</main>
		</>
	);
};

export default ClaimRewards;
