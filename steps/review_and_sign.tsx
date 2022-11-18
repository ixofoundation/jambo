import { FC, useContext, useEffect, useState } from 'react';
import cls from 'classnames';

import utilsStyles from '@styles/utils.module.scss';
import styles from '@styles/stepsPages.module.scss';
import Header from '@components/header/header';
import Footer from '@components/footer/footer';
import Input from '@components/input/input';
import { ReviewStepsTypes, STEP, StepDataType, STEPS } from 'types/steps';
import { WalletContext } from '@contexts/wallet';
import { defaultTrxFee } from '@utils/transactions';
import { broadCastMessages } from '@utils/wallets';
import { getMicroAmount } from '@utils/encoding';
import { generateBankSendTrx, generateDelegateTrx } from '@utils/client';
import Loader from '@components/loader/loader';
import { TRX_MSG } from 'types/transactions';
import { TokenDropdownType } from '@utils/currency';
import IconText from '@components/icon-text/icon-text';
import Success from '@icons/success.svg';
import { VALIDATOR } from 'types/validators';

type ReviewAndSignProps = {
	onSuccess: (data: StepDataType<STEPS.review_and_sign>) => void;
	onBack?: () => void;
	steps: STEP[];
	header?: string;
	message: ReviewStepsTypes;
};

const ReviewAndSign: FC<ReviewAndSignProps> = ({ onSuccess, onBack, steps, header, message }) => {
	const { wallet } = useContext(WalletContext);
	const [success, setSuccess] = useState(false);
	const [loading, setLoading] = useState(false);
	const [amount, setAmount] = useState(0);
	const [token, setToken] = useState<TokenDropdownType | null>(null);
	const [address, setAddress] = useState('');
	const [validator, setValidator] = useState<VALIDATOR | null>(null);

	useEffect(() => {
		steps.forEach((s) => {
			if (s.id === STEPS.select_token_and_amount) {
				setAmount((s.data as StepDataType<STEPS.select_token_and_amount>)?.amount ?? 0);
				setToken((s.data as StepDataType<STEPS.select_token_and_amount>)?.token);
			}
			if (s.id === STEPS.select_delegate_amount) {
				setAmount((s.data as StepDataType<STEPS.select_delegate_amount>)?.amount ?? 0);
				setToken((s.data as StepDataType<STEPS.select_delegate_amount>)?.token);
			}
			if (s.id === STEPS.get_receiver_address) {
				setAddress((s.data as StepDataType<STEPS.get_receiver_address>)?.address ?? '');
			}
			if (s.id === STEPS.get_validator_address) {
				setAddress((s.data as StepDataType<STEPS.get_validator_address>)?.validator?.address ?? '');
				setValidator((s.data as StepDataType<STEPS.get_validator_address>)?.validator);
			}
		});
	}, [steps]);

	const signTX = async (): Promise<void> => {
		setLoading(true);
		let trx: TRX_MSG;
		switch (message) {
			case STEPS.bank_MsgSend:
				trx = generateBankSendTrx({
					fromAddress: wallet.user!.address,
					toAddress: address,
					denom: 'uixo',
					amount: getMicroAmount(amount.toString()),
				});
				break;
			case STEPS.staking_MsgDelegate:
				trx = generateDelegateTrx({
					delegatorAddress: wallet.user!.address,
					validatorAddress: address,
					denom: 'uixo',
					amount: getMicroAmount(amount.toString()),
				});
				break;
			default:
				throw new Error('Unsupported review type');
		}
		const hash = await broadCastMessages(wallet, [trx], undefined, defaultTrxFee);
		if (hash) setSuccess(true);
		setLoading(false);
	};

	return (
		<>
			<Header
				pageTitle={
					message === STEPS.bank_MsgSend
						? 'Review and sign'
						: message === STEPS.staking_MsgDelegate
						? 'Confirm delegation'
						: 'Unsupported review type'
				}
				header={header}
			/>

			<main className={cls(utilsStyles.main, utilsStyles.columnJustifyCenter, styles.stepContainer)}>
				{loading ? (
					<Loader />
				) : success ? (
					<IconText text="Transaction successful!" Img={Success} imgSize={50} />
				) : message === STEPS.bank_MsgSend ? (
					<form className={styles.stepsForm} autoComplete="none">
						<p>I am sending</p>
						<div className={styles.amountAndTokenInputs}>
							<Input name="amount" required value={amount} className={styles.stepInput} disabled />
							<Input name="token" required value={token?.label ?? ''} disabled className={styles.tokenInput} size={8} />
						</div>
						<br />
						<p>to the address:</p>
						<Input name="address" required value={address} className={styles.stepInput} disabled />
						<br />
						<p>Sign?</p>
					</form>
				) : message === STEPS.staking_MsgDelegate ? (
					<form className={styles.stepsForm} autoComplete="none">
						<p>I am delegating</p>
						<div className={styles.amountAndTokenInputs}>
							<Input name="amount" required value={amount} className={styles.stepInput} disabled />
							<Input name="token" required value={token?.label ?? ''} disabled className={styles.tokenInput} size={8} />
						</div>
						<br />
						<p>to the validator:</p>
						{/* <Input name="address" required value={address} className={styles.stepInput} disabled /> */}
						<div className={styles.validatorWrapper}>
							<span className={styles.validatorRank}>{validator?.votingRank}</span>
							<span className={styles.validatorAvatar}></span>
							<span className={styles.validatorMoniker}>{validator?.moniker} </span>
							<span className={styles.validatorCommission}>{validator?.commission}%</span>
						</div>
						<br />
						<p>Sign?</p>
					</form>
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

export default ReviewAndSign;
