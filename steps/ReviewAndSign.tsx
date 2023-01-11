import { FC, useContext, useEffect, useState } from 'react';
import cls from 'classnames';

import utilsStyles from '@styles/utils.module.scss';
import styles from '@styles/stepsPages.module.scss';
import Header from '@components/Header/Header';
import Footer from '@components/Footer/Footer';
import Input from '@components/Input/Input';
import { ReviewStepsTypes, STEP, StepDataType, STEPS } from 'types/steps';
import { WalletContext } from '@contexts/wallet';
import { defaultTrxFee } from '@utils/transactions';
import { broadCastMessages } from '@utils/wallets';
import { getMicroAmount } from '@utils/encoding';
import { generateBankSendTrx, generateDelegateTrx, generateRedelegateTrx, generateUndelegateTrx } from '@utils/client';
import Loader from '@components/loader/loader';
import { TRX_MSG } from 'types/transactions';
import { TokenDropdownType } from '@utils/currency';
import IconText from '@components/IconText/IconText';
import Success from '@icons/success.svg';
import { VALIDATOR } from 'types/validators';
import ValidatorListItem from '@components/ValidatorListItem/ValidatorListItem';

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
	const [address, setAddress] = useState(''); // destination address
	const [srcAddress, setSrcAddress] = useState(''); // source address
	const [validator, setValidator] = useState<VALIDATOR | null>(null); // destination validator
	const [srcValidator, setSrcValidator] = useState<VALIDATOR | null>(null); // source validator

	useEffect(() => {
		steps.forEach((s) => {
			if (
				s.id === STEPS.select_token_and_amount ||
				s.id === STEPS.select_delegate_amount ||
				s.id === STEPS.select_undelegate_amount ||
				s.id === STEPS.select_redelegate_amount
			) {
				setAmount((s.data as StepDataType<STEPS.select_token_and_amount>)?.amount ?? 0);
				setToken((s.data as StepDataType<STEPS.select_token_and_amount>)?.token);
			}
			if (s.id === STEPS.get_receiver_address) {
				setAddress((s.data as StepDataType<STEPS.get_receiver_address>)?.address ?? '');
			}
			if (
				s.id === STEPS.get_validator_address ||
				s.id === STEPS.get_delegated_validator_undelegate ||
				s.id === STEPS.get_validator_redelegate
			) {
				setAddress((s.data as StepDataType<STEPS.get_validator_address>)?.validator?.address ?? '');
				setValidator((s.data as StepDataType<STEPS.get_validator_address>)?.validator);
			}
			if (s.id === STEPS.get_delegated_validator_redelegate) {
				setSrcAddress((s.data as StepDataType<STEPS.get_validator_address>)?.validator?.address ?? '');
				setSrcValidator((s.data as StepDataType<STEPS.get_validator_address>)?.validator);
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
			case STEPS.staking_MsgUndelegate:
				trx = generateUndelegateTrx({
					delegatorAddress: wallet.user!.address,
					validatorAddress: address,
					denom: 'uixo',
					amount: getMicroAmount(amount.toString()),
				});
				break;
			case STEPS.staking_MsgRedelegate:
				trx = generateRedelegateTrx({
					delegatorAddress: wallet.user!.address,
					validatorSrcAddress: srcAddress,
					validatorDstAddress: address,
					denom: 'uixo',
					amount: getMicroAmount(amount.toString()),
				});
				console.log({
					trx,
					request: {
						delegatorAddress: wallet.user!.address,
						validatorSrcAddress: srcAddress,
						validatorDstAddress: address,
						denom: 'uixo',
						amount: getMicroAmount(amount.toString()),
					},
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
						: message === STEPS.staking_MsgUndelegate
						? 'Confirm undelegation'
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
				) : message === STEPS.staking_MsgDelegate || message === STEPS.staking_MsgUndelegate ? (
					<form className={styles.stepsForm} autoComplete="none">
						{message === STEPS.staking_MsgDelegate && <p>I am delegating</p>}
						{message === STEPS.staking_MsgUndelegate && <p>I want to undelegating</p>}
						<div className={styles.amountAndTokenInputs}>
							<Input name="amount" required value={amount} className={styles.stepInput} disabled />
							<Input name="token" required value={token?.label ?? ''} disabled className={styles.tokenInput} size={8} />
						</div>
						<br />
						{message === STEPS.staking_MsgDelegate && <p>to the validator:</p>}
						{message === STEPS.staking_MsgUndelegate && <p>with the validator:</p>}

						{/* <Input name="address" required value={address} className={styles.stepInput} disabled /> */}
						<ValidatorListItem validator={validator!} onClick={() => () => {}} />
						<br />
						<p>Sign?</p>
					</form>
				) : message === STEPS.staking_MsgRedelegate ? (
					<form className={styles.stepsForm} autoComplete="none">
						<p>I want to redelegating</p>
						<div className={styles.amountAndTokenInputs}>
							<Input name="amount" required value={amount} className={styles.stepInput} disabled />
							<Input name="token" required value={token?.label ?? ''} disabled className={styles.tokenInput} size={8} />
						</div>
						<br />
						<p>From validator</p>
						<ValidatorListItem validator={srcValidator!} onClick={() => () => {}} />
						<p>To validator</p>
						<ValidatorListItem validator={validator!} onClick={() => () => {}} />
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
