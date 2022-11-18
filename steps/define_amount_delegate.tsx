import { ChangeEvent, FormEvent, useContext, useEffect, useState } from 'react';
import { FC } from 'react';
import cls from 'classnames';

import utilsStyles from '@styles/utils.module.scss';
import styles from '@styles/stepsPages.module.scss';
import Header from '@components/header/header';
import Footer from '@components/footer/footer';
import Input from '@components/input/input';
import { StepDataType, STEPS } from 'types/steps';
import { WalletContext } from '@contexts/wallet';
import { formatTokenAmount, validateAmountAgainstBalance } from '@utils/currency';
import IconText from '@components/icon-text/icon-text';
import SadFace from '@icons/sad_face.svg';

type DefineAmountTokenProps = {
	onSuccess: (data: StepDataType<STEPS.select_delegate_amount>) => void;
	onBack?: () => void;
	data?: StepDataType<STEPS.select_delegate_amount>;
	header?: string;
};

const TOKEN = {
	amount: 10000000,
	img: 'https://app.osmosis.zone/tokens/ixo.png',
	label: 'IXO',
	value: 'uixo',
};

const DefineAmountDelegate: FC<DefineAmountTokenProps> = ({ onSuccess, onBack, data, header }) => {
	const [amount, setAmount] = useState(data?.amount?.toString() ?? '');
	const { wallet, fetchAssets } = useContext(WalletContext);

	useEffect(() => {
		fetchAssets();
	}, []);

	const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
		setAmount(event.target.value);
	};

	const formIsValid = () =>
		!!TOKEN && Number.parseFloat(amount) > 0 && validateAmountAgainstBalance(Number.parseFloat(amount), TOKEN.amount);

	const handleSubmit = (event: FormEvent<HTMLFormElement> | null) => {
		event?.preventDefault();
		if (!formIsValid()) return alert('Amount must be bigger than 0 and less than balance.');
		onSuccess({ amount: Number.parseFloat(amount), token: TOKEN });
	};

	const handleMaxClicked = () => {
		if (!TOKEN?.amount) return;
		const tokenAmount = TOKEN?.amount / 10 ** 6;
		setAmount(tokenAmount.toString());
	};

	return (
		<>
			<Header pageTitle="Define amount to delegate" header={header} />

			<main className={cls(utilsStyles.main, utilsStyles.columnJustifyCenter, styles.stepContainer)}>
				<div className={utilsStyles.spacer} />
				{wallet.balances?.balances?.length ? (
					<form className={styles.stepsForm} onSubmit={handleSubmit} autoComplete="none">
						<p>Enter amount to delegate:</p>
						<div className={styles.inputRow}>
							<div className={styles.amountWrapper}>
								<p className={cls(styles.subtext, styles.alignRight)} onClick={handleMaxClicked}>
									Max: {TOKEN ? `${formatTokenAmount(TOKEN?.amount)} ${TOKEN.label}` : '-'}
								</p>
								<Input
									name="walletAddress"
									type="number"
									required
									onChange={handleChange}
									value={amount}
									className={cls(styles.stepInput, styles.alignRight)}
								/>
							</div>
							<div className={styles.tokenWrapper}>{TOKEN.label}</div>
						</div>
						<p>Your tokens will be locked for 21 days.</p>
						<div className={utilsStyles.spacer} />
					</form>
				) : (
					<IconText text="You don't have any tokens to stake." Img={SadFace} imgSize={50} />
				)}

				<Footer
					onBack={onBack}
					onBackUrl={onBack ? undefined : ''}
					onCorrect={formIsValid() ? () => handleSubmit(null) : null}
				/>
			</main>
		</>
	);
};

export default DefineAmountDelegate;
