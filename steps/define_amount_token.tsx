import { ChangeEvent, FormEvent, useState } from 'react';
import { FC } from 'react';
import cls from 'classnames';

import utilsStyles from '@styles/utils.module.scss';
import styles from '@styles/stepsPages.module.scss';
import Header from '@components/header/header';
import Footer from '@components/footer/footer';
import Input from '@components/input/input';
import Dropdown from '@components/dropdown/dropdown';
import { StepDataType, STEPS, TokenOptions, TokenOptionType } from 'types/steps';

type DefineAmountTokenProps = {
	onSuccess: (data: StepDataType<STEPS.select_token_and_amount>) => void;
	onBack?: () => void;
	data?: StepDataType<STEPS.select_token_and_amount>;
	header?: string;
};

const DefineAmountToken: FC<DefineAmountTokenProps> = ({ onSuccess, onBack, data, header }) => {
	const [amount, setAmount] = useState(data?.amount?.toString() ?? '');
	const [selectedOption, setSelectedOption] = useState<TokenOptionType>(data?.token ?? null);

	const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
		setAmount(event.target.value);
	};

	const formIsValid = () => Number.parseFloat(amount) > 0 && !!selectedOption;

	const handleSubmit = (event: FormEvent<HTMLFormElement> | null) => {
		event?.preventDefault();
		if (!formIsValid()) return alert('Amount must be bigger than 0 and a token is required');
		onSuccess({ amount: Number.parseFloat(amount), token: selectedOption });
	};

	return (
		<>
			<Header pageTitle="Define amount to be sent" header={header} />

			<main className={cls(utilsStyles.main, utilsStyles.columnJustifyCenter, styles.stepContainer)}>
				<form className={styles.stepsForm} onSubmit={handleSubmit} autoComplete="none">
					<p>Select token to be sent:</p>
					<Dropdown defaultValue={selectedOption} onChange={option => setSelectedOption(option as TokenOptionType)} options={TokenOptions} placeholder={null} name="token" />
					<br />
					<p>Enter Amount:</p>
					<Input name="address" type="number" required onChange={handleChange} value={amount} className={styles.stepInput} />
				</form>
			</main>

			<Footer onBack={onBack} onBackUrl={onBack ? undefined : ''} onCorrect={formIsValid() ? () => handleSubmit(null) : null} />
		</>
	);
};

export default DefineAmountToken;
