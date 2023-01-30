import { FC, useState, useEffect, useContext } from 'react';
import cls from 'classnames';

import utilsStyles from '@styles/utils.module.scss';
import styles from '@styles/stepsPages.module.scss';
import ValidatorListItem from '@components/ValidatorListItem/ValidatorListItem';
import IconText from '@components/IconText/IconText';
import Header from '@components/Header/Header';
import Loader from '@components/Loader/Loader';
import Footer from '@components/Footer/Footer';
import SadFace from '@icons/sad_face.svg';
import Success from '@icons/success.svg';
import { defaultTrxFeeOption, generateWithdrawRewardTrx } from '@utils/transactions';
import { broadCastMessages } from '@utils/wallets';
import { WalletContext } from '@contexts/wallet';
import { ReviewStepsTypes, StepDataType, STEPS } from 'types/steps';
import { VALIDATOR } from 'types/validators';
import { TRX_MSG } from 'types/transactions';
import useGlobalValidators from '@hooks/globalValidators';

type ValidatorAddressProps = {
	onSuccess: (data: StepDataType<STEPS.review_and_sign>) => void;
	onBack?: () => void;
	data?: StepDataType<STEPS.get_validator_delegate>;
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
	const [success, setSuccess] = useState(false);
	const [loading, setLoading] = useState(true);
	const [rewards, setRewards] = useState<string>();
	const { wallet } = useContext(WalletContext);
	const { validators, validatorsLoading } = useGlobalValidators({ delegatedValidatorsOnly: true });

	useEffect(() => {
		if (validators?.length) setRewards(calculateAccumulatedRewards(validators));
		if (loading && validators !== null) setLoading(false);
	}, [validators]);

	const signTX = async (): Promise<void> => {
		if (!validators) return;
		setLoading(true);
		const trxs: TRX_MSG[] = validators.map((validator) =>
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
				{loading || validatorsLoading ? (
					<Loader />
				) : success ? (
					<IconText text="transaction successful!" Img={Success} imgSize={50} />
				) : message === STEPS.distribution_MsgWithdrawDelegatorReward ? (
					validators?.length ? (
						<form className={styles.stepsForm} autoComplete="none">
							<p>Your delegations</p>
							{validators.map((validator: any, index: number) => {
								return <ValidatorListItem key={validator.address} validator={validator} />;
							})}
							<div className={utilsStyles.spacer} />
							<p>Combined Rewards</p>
							<p className={styles.rewardListItem}>{rewards} IXO</p>
							<div className={utilsStyles.spacer} />
							<p>Claim?</p>
						</form>
					) : (
						<IconText text="You don't have any tokens delegated for this account." Img={SadFace} imgSize={50} />
					)
				) : (
					<p>Unsupported review type</p>
				)}
				<Footer
					onBack={loading || success ? null : onBack}
					onBackUrl={onBack ? undefined : ''}
					onCorrect={
						loading || validatorsLoading || !validators?.length
							? null
							: success
							? () => onSuccess({ done: true })
							: signTX
					}
				/>
			</main>
		</>
	);
};

export default ClaimRewards;
