import { FC, useEffect, useState } from 'react';
import cls from 'classnames';

import utilsStyles from '@styles/utils.module.scss';
import styles from '@styles/stepsPages.module.scss';
import Header from '@components/header/header';
import Footer from '@components/footer/footer';
import Input from '@components/input/input';
import { STEP, StepDataType, STEPS, TokenOptionType } from 'types/steps';

type ReviewAndSignProps = {
	onSuccess: (data: StepDataType<STEPS.review_and_sign>) => void;
	onBack?: () => void;
	steps: STEP[];
	header?: string;
};

const ReviewAndSign: FC<ReviewAndSignProps> = ({ onSuccess, onBack, steps, header }) => {
	const [amount, setAmount] = useState(0);
	const [token, setToken] = useState<TokenOptionType>(null);
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
		});
	}, [steps]);

	return (
		<>
			<Header pageTitle="Review and sign" header={header} />

			<main className={cls(utilsStyles.main, utilsStyles.columnJustifyCenter, styles.stepContainer)}>
				<form className={styles.stepsForm} autoComplete="none">
					<p>I am sending</p>
					<div className={styles.amountAndTokenInputs}>
						<Input name="amount" required value={amount} className={styles.stepInput} disabled />
						<Input name="token" required value={token?.label} disabled className={styles.tokenInput} size={8} />
					</div>
					<br />

					<p>to the address:</p>
					<Input name="address" required value={address} className={styles.stepInput} disabled />
					<br />

					<p>Sign?</p>
				</form>
			</main>

			<Footer onBack={onBack} onBackUrl={onBack ? undefined : ''} onCorrect={() => onSuccess({ done: true })} />
		</>
	);
};

export default ReviewAndSign;
