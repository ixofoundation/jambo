import { FC, useContext, useEffect, useState } from 'react';
import cls from 'classnames';

import utilsStyles from '@styles/utils.module.scss';
import styles from '@styles/stepsPages.module.scss';
import ValidatorListItem from '@components/ValidatorListItem/ValidatorListItem';
import IconText from '@components/IconText/IconText';
import Header from '@components/Header/Header';
import Footer from '@components/Footer/Footer';
import Loader from '@components/Loader/Loader';
import Input from '@components/Input/Input';
import Success from '@icons/success.svg';
import { ReviewStepsTypes, STEP, StepDataType, STEPS } from 'types/steps';
import { KEPLR_CHAIN_INFO_TYPE } from 'types/chain';
import { VALIDATOR } from 'types/validators';
import { TRX_MSG } from 'types/transactions';
import { TokenDropdownType } from '@utils/currency';
import { broadCastMessages } from '@utils/wallets';
import { getMicroAmount } from '@utils/encoding';
import {
	defaultTrxFeeOption,
	generateBankSendTrx,
	generateDelegateTrx,
	generateRedelegateTrx,
	generateUndelegateTrx,
} from '@utils/transactions';
import { WalletContext } from '@contexts/wallet';
import { ChainContext } from '@contexts/chain';

type ReviewAndSignProps = {
	onSuccess: (data: StepDataType<STEPS.review_and_sign>) => void;
	onBack?: () => void;
	steps: STEP[];
	header?: string;
	message: ReviewStepsTypes;
};

const ReviewAndSign: FC<ReviewAndSignProps> = ({ onSuccess, onBack, steps, header, message }) => {
	const { wallet } = useContext(WalletContext);
	const [success, setSuccess] = useState<boolean>(false);
	const [loading, setLoading] = useState<boolean>(false);
	const [amount, setAmount] = useState<number>(0);
	const [token, setToken] = useState<TokenDropdownType | null>(null);
	const [dstAddress, setDstAddress] = useState<string>(''); // destination address
	const [srcAddress, setSrcAddress] = useState<string>(''); // source address
	const [dstValidator, setDstValidator] = useState<VALIDATOR | null>(null); // destination validator
	const [srcValidator, setSrcValidator] = useState<VALIDATOR | null>(null); // source validator
	const { chainInfo } = useContext(ChainContext);

	useEffect(() => {
		steps.forEach((s) => {
			if (
				s.id === STEPS.select_token_and_amount ||
				s.id === STEPS.select_amount_delegate ||
				s.id === STEPS.select_amount_undelegate ||
				s.id === STEPS.select_amount_redelegate
			) {
				console.log(s);
				setAmount((s.data as StepDataType<STEPS.select_token_and_amount>)?.amount ?? 0);
				setToken((s.data as StepDataType<STEPS.select_token_and_amount>)?.token);
			}
			if (s.id === STEPS.get_receiver_address) {
				setDstAddress((s.data as StepDataType<STEPS.get_receiver_address>)?.address ?? '');
			}
			if (
				s.id === STEPS.get_validator_delegate ||
				s.id === STEPS.get_delegated_validator_undelegate ||
				s.id === STEPS.get_validator_redelegate
			) {
				setDstAddress((s.data as StepDataType<STEPS.get_validator_delegate>)?.validator?.address ?? '');
				setDstValidator((s.data as StepDataType<STEPS.get_validator_delegate>)?.validator);
			}
			if (s.id === STEPS.get_delegated_validator_redelegate) {
				setSrcAddress((s.data as StepDataType<STEPS.get_validator_delegate>)?.validator?.address ?? '');
				setSrcValidator((s.data as StepDataType<STEPS.get_validator_delegate>)?.validator);
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
					toAddress: dstAddress,
					denom: token?.value ?? '',
					amount: getMicroAmount(amount.toString()),
				});
				break;
			case STEPS.staking_MsgDelegate:
				trx = generateDelegateTrx({
					delegatorAddress: wallet.user!.address,
					validatorAddress: dstAddress,
					denom: token?.value ?? '',
					amount: getMicroAmount(amount.toString()),
				});
				break;
			case STEPS.staking_MsgUndelegate:
				trx = generateUndelegateTrx({
					delegatorAddress: wallet.user!.address,
					validatorAddress: dstAddress,
					denom: token?.value ?? '',
					amount: getMicroAmount(amount.toString()),
				});
				break;
			case STEPS.staking_MsgRedelegate:
				trx = generateRedelegateTrx({
					delegatorAddress: wallet.user!.address,
					validatorSrcAddress: srcAddress,
					validatorDstAddress: dstAddress,
					denom: token?.value ?? '',
					amount: getMicroAmount(amount.toString()),
				});
				break;
			default:
				throw new Error('Unsupported review type');
		}
		const hash = await broadCastMessages(
			wallet,
			[trx],
			undefined,
			defaultTrxFeeOption,
			token?.label ?? '',
			chainInfo as KEPLR_CHAIN_INFO_TYPE,
		);
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
						<Input name="address" required value={dstAddress} className={styles.stepInput} disabled />
						<br />
						<p>Sign?</p>
					</form>
				) : message === STEPS.staking_MsgDelegate || message === STEPS.staking_MsgUndelegate ? (
					<form className={styles.stepsForm} autoComplete="none">
						{message === STEPS.staking_MsgDelegate && <p>Delegating</p>}
						{message === STEPS.staking_MsgUndelegate && <p>Undelegate</p>}
						<div className={styles.amountAndTokenInputs}>
							<Input name="amount" required value={amount} className={styles.stepInput} disabled />
							<Input name="token" required value={token?.label ?? ''} disabled className={styles.tokenInput} size={8} />
						</div>
						<br />
						{message === STEPS.staking_MsgDelegate && <p>to the validator</p>}
						{message === STEPS.staking_MsgUndelegate && <p>from the validator</p>}

						<ValidatorListItem validator={dstValidator!} onClick={() => () => {}} />
						<br />
						<p>Sign?</p>
					</form>
				) : message === STEPS.staking_MsgRedelegate ? (
					<form className={styles.stepsForm} autoComplete="none">
						<p>Redelegate</p>
						<div className={styles.amountAndTokenInputs}>
							<Input name="amount" required value={amount} className={styles.stepInput} disabled />
							<Input name="token" required value={token?.label ?? ''} disabled className={styles.tokenInput} size={8} />
						</div>
						<br />
						<p>from</p>
						<ValidatorListItem validator={srcValidator!} onClick={() => () => {}} />
						<p>to</p>
						<ValidatorListItem validator={dstValidator!} onClick={() => () => {}} />
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
					correctLabel={loading ? 'Signing' : success ? 'Done' : 'Sign'}
				/>
			</main>
		</>
	);
};

export default ReviewAndSign;
