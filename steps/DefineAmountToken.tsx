import { ChangeEvent, FormEvent, useContext, useEffect, useState, FC } from 'react';
import cls from 'classnames';

import utilsStyles from '@styles/utils.module.scss';
import styles from '@styles/stepsPages.module.scss';
import IconText from '@components/IconText/IconText';
import Dropdown from '@components/Dropdown/Dropdown';
import Header from '@components/Header/Header';
import Footer from '@components/Footer/Footer';
import Input from '@components/Input/Input';
import SadFace from '@icons/sad_face.svg';
import { StepDataType, STEPS } from 'types/steps';
import { WalletContext } from '@contexts/wallet';
import {
	calculateMaxTokenAmount,
	calculateTokenAmount,
	generateUserTokensDropdown,
	TokenDropdownType,
	validateAmountAgainstBalance,
} from '@utils/currency';

type DefineAmountTokenProps = {
	onSuccess: (data: StepDataType<STEPS.select_token_and_amount>) => void;
	onBack?: () => void;
	data?: StepDataType<STEPS.select_token_and_amount>;
	header?: string;
};

const DefineAmountToken: FC<DefineAmountTokenProps> = ({ onSuccess, onBack, data, header }) => {
	const [amount, setAmount] = useState(data?.amount?.toString() ?? '');
	const [selectedOption, setSelectedOption] = useState<TokenDropdownType | null>(data?.token || null);
	const { wallet, fetchAssets } = useContext(WalletContext);

	useEffect(() => {
		fetchAssets();
	}, []);

	const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
		setAmount(event.target.value);
	};

	const formIsValid = () =>
		!!selectedOption &&
		Number.parseFloat(amount) > 0 &&
		validateAmountAgainstBalance(Number.parseFloat(amount), Number(selectedOption.amount));

	const handleSubmit = (event: FormEvent<HTMLFormElement> | null) => {
		event?.preventDefault();
		if (!formIsValid()) return alert('A token is required and amount must be bigger than 0 and less than balance.');
		onSuccess({ amount: Number.parseFloat(amount), token: selectedOption! });
	};

	const handleMaxClicked = () => {
		if (!selectedOption?.amount) return;
		const tokenAmount = calculateTokenAmount(Number(selectedOption?.amount ?? 0), true, true);
		setAmount(tokenAmount.toString());
	};

	const TokenDropdownOptions = generateUserTokensDropdown(wallet.balances?.balances ?? []);

	return (
		<>
			<Header pageTitle="Define amount to be sent" header={header} />

			<main className={cls(utilsStyles.main, utilsStyles.columnJustifyCenter, styles.stepContainer)}>
				<div className={utilsStyles.spacer} />
				{wallet.balances?.balances ? (
					<form className={styles.stepsForm} onSubmit={handleSubmit} autoComplete="none">
						<p>Select token to be sent:</p>
						<div className={styles.alignLeft}>
							<Dropdown
								defaultValue={selectedOption}
								onChange={(option) => setSelectedOption(option as TokenDropdownType)}
								options={TokenDropdownOptions}
								placeholder={null}
								name="token"
								withLogos={true}
							/>
						</div>
						<br />
						<p className={styles.titleWithSubtext}>Enter Amount:</p>
						<p className={cls(styles.subtext, styles.alignRight)} onClick={handleMaxClicked}>
							Max:{' '}
							{selectedOption
								? `${calculateMaxTokenAmount(Number(selectedOption?.amount ?? 0), true, true)} ${selectedOption.label}`
								: '-'}
						</p>
						<Input
							name="walletAddress"
							type="number"
							required
							onChange={handleChange}
							value={amount}
							className={cls(styles.stepInput, styles.alignRight)}
						/>
					</form>
				) : (
					<IconText text="You don't have any tokens to send." Img={SadFace} imgSize={50} />
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

export default DefineAmountToken;
