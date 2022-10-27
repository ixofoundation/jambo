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

type ReviewAndSignProps = {
	onSuccess: (data: StepDataType<STEPS.review_and_sign>) => void;
	onBack?: () => void;
	steps: STEP[];
	header?: string;
	message: ReviewStepsTypes;
};

const ReviewAndSign: FC<ReviewAndSignProps> = ({ onSuccess, onBack, steps, header, message }) => {
	const { wallet } = useContext(WalletContext);
	const [loading, setLoading] = useState(false);
	const [amount, setAmount] = useState(0);
	const [token, setToken] = useState<TokenDropdownType | null>(null);
	const [address, setAddress] = useState('');

	useEffect(() => {
		steps.forEach(s => {
			if (s.id === STEPS.select_token_and_amount) {
				setAmount((s.data as StepDataType<STEPS.select_token_and_amount>)?.amount ?? 0);
				setToken((s.data as StepDataType<STEPS.select_token_and_amount>)?.token);
			}
			if (s.id === STEPS.get_receiver_address) {
				setAddress((s.data as StepDataType<STEPS.get_receiver_address>)?.address ?? '');
			}
			if (s.id === STEPS.get_validator_address) {
				setAddress((s.data as StepDataType<STEPS.get_validator_address>)?.address ?? '');
			}
		});
	}, [steps]);

	const signTX = async (): Promise<void> => {
		setLoading(true);
		let trx: TRX_MSG;
		switch (message) {
			case STEPS.bank_MsgSend:
				trx = generateBankSendTrx({ fromAddress: wallet.user!.address, toAddress: address, denom: 'uixo', amount: getMicroAmount(amount.toString()) });
				break;
			case STEPS.staking_MsgDelegate:
				trx = generateDelegateTrx({ delegatorAddress: wallet.user!.address, validatorAddress: address, denom: 'uixo', amount: getMicroAmount(amount.toString()) });
				break;
			default:
				throw new Error('Unsupported review type');
		}
		const hash = await broadCastMessages(wallet, [trx], undefined, defaultTrxFee);
		console.log({ hash });
		if (hash) {
			onSuccess({ done: true });
		}
		setLoading(false);
	};

	return (
		<>
			<Header pageTitle="Review and sign" header={header} />

			<main className={cls(utilsStyles.main, utilsStyles.columnJustifyCenter, styles.stepContainer)}>
				{loading ? (
					<Loader />
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
						<p>I want to stake</p>
						<div className={styles.amountAndTokenInputs}>
							<Input name="amount" required value={amount} className={styles.stepInput} disabled />
							<Input name="token" required value={token?.label ?? ''} disabled className={styles.tokenInput} size={8} />
						</div>
						<br />
						<p>at validator:</p>
						<Input name="address" required value={address} className={styles.stepInput} disabled />
						<br />
						<p>Sign?</p>
					</form>
				) : (
					<p>Unsupported review type</p>
				)}
			</main>

			<Footer onBack={onBack} onBackUrl={onBack ? undefined : ''} onCorrect={signTX} />
		</>
	);
};

export default ReviewAndSign;
