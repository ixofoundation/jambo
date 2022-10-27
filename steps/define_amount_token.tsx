import { ChangeEvent, FormEvent, useContext, useState } from 'react';
import { FC } from 'react';
import cls from 'classnames';

import utilsStyles from '@styles/utils.module.scss';
import styles from '@styles/stepsPages.module.scss';
import Header from '@components/header/header';
import Footer from '@components/footer/footer';
import Input from '@components/input/input';
import Dropdown from '@components/dropdown/dropdown';
import { StepDataType, STEPS } from 'types/steps';
import { WalletContext } from '@contexts/wallet';
import { formatTokenAmount, generateUserTokensDropdown, TokenDropdownType, validateAmountAgainstBalance } from '@utils/currency';

type DefineAmountTokenProps = {
	onSuccess: (data: StepDataType<STEPS.select_token_and_amount>) => void;
	onBack?: () => void;
	data?: StepDataType<STEPS.select_token_and_amount>;
	header?: string;
};

const DefineAmountToken: FC<DefineAmountTokenProps> = ({ onSuccess, onBack, data, header }) => {
	const [amount, setAmount] = useState(data?.amount?.toString() ?? '');
	const [selectedOption, setSelectedOption] = useState<TokenDropdownType | null>(data?.token || null);
	const { wallet } = useContext(WalletContext);

	const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
		setAmount(event.target.value);
	};

	const formIsValid = () => !!selectedOption && Number.parseFloat(amount) > 0 && validateAmountAgainstBalance(Number.parseFloat(amount), selectedOption.amount);

	const handleSubmit = (event: FormEvent<HTMLFormElement> | null) => {
		event?.preventDefault();
		if (!formIsValid()) return alert('A token is required and smount must be bigger than 0 and less than balance.');
		onSuccess({ amount: Number.parseFloat(amount), token: selectedOption! });
	};

	const TokenDropdownOptions = generateUserTokensDropdown(wallet.user?.balances ?? []);

	return (
		<>
			<Header pageTitle="Define amount to be sent" header={header} />

			<main className={cls(utilsStyles.main, utilsStyles.columnJustifyCenter, styles.stepContainer)}>
				{wallet.user?.balances ? (
					<form className={styles.stepsForm} onSubmit={handleSubmit} autoComplete="none">
						<p>Select token to be sent:</p>
						<div className={styles.alignLeft}>
							<Dropdown defaultValue={selectedOption} onChange={option => setSelectedOption(option as TokenDropdownType)} options={TokenDropdownOptions} placeholder={null} name="token" withLogos={true} />
						</div>
						<br />
						<p className={styles.titleWithSubtext}>Enter Amount:</p>
						<p className={cls(styles.subtext, styles.alignRight)}>Balance: {selectedOption ? `${formatTokenAmount(selectedOption?.amount)} ${selectedOption.label}` : '-'}</p>
						<Input name="walletAddress" type="number" required onChange={handleChange} value={amount} className={cls(styles.stepInput, styles.alignRight)} />
					</form>
				) : (
					<p>You don't have any balances at the moments.</p>
				)}
			</main>

			<Footer onBack={onBack} onBackUrl={onBack ? undefined : ''} onCorrect={formIsValid() ? () => handleSubmit(null) : null} />
		</>
	);
};

export default DefineAmountToken;
