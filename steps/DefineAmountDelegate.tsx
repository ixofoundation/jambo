import { ChangeEvent, FormEvent, useContext, useEffect, useState, FC } from 'react';
import { DecCoin } from '@ixo/impactxclient-sdk/types/codegen/cosmos/base/v1beta1/coin';
import cls from 'classnames';

import ValidatorListItem from '@components/ValidatorListItem/ValidatorListItem';
import IconText from '@components/IconText/IconText';
import Header from '@components/Header/Header';
import Footer from '@components/Footer/Footer';
import Input from '@components/Input/Input';
import SadFace from '@icons/sad_face.svg';
import utilsStyles from '@styles/utils.module.scss';
import styles from '@styles/stepsPages.module.scss';
import { VALIDATOR, ValidatorAmountConfig } from 'types/validators';
import { StepDataType, STEPS } from 'types/steps';
import { WalletContext } from '@contexts/wallet';
import { formatTokenAmount, validateAmountAgainstBalance, generateUserTokensDropdown, TokenDropdownType } from '@utils/currency';

type DefineAmountTokenProps = {
	onSuccess: (data: StepDataType<STEPS.select_delegate_amount>) => void;
	onBack?: () => void;
	data?: StepDataType<STEPS.select_delegate_amount>;
	header?: string;
	validator: VALIDATOR | null;
	config: ValidatorAmountConfig;
};

const DefineAmountDelegate: FC<DefineAmountTokenProps> = ({ onSuccess, onBack, data, header, validator, config }) => {
	const delegated = !!validator?.delegation?.shares;
	const [amount, setAmount] = useState(data?.amount?.toString() ?? '');
	const [max, setMax] = useState<TokenDropdownType | null>(null);
	const { wallet, fetchAssets } = useContext(WalletContext);

	useEffect(() => {
		fetchAssets();

		const ixoCurrency = config.source === 'wallet' ? wallet?.balances?.balances?.find((balance: DecCoin) => balance.denom === 'uixo') : config.source === 'validator' ? validator?.delegation?.balance : null;

		const tokenDropdown = generateUserTokensDropdown(ixoCurrency ? [ixoCurrency] : []);

		if (tokenDropdown.length) {
			setMax(tokenDropdown[0]);
		}
	}, []);

	const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
		setAmount(event.target.value);
	};

	const formIsValid = () => !!max && Number.parseFloat(amount) > 0 && validateAmountAgainstBalance(Number.parseFloat(amount), Number(max.amount));

	const handleSubmit = (event: FormEvent<HTMLFormElement> | null) => {
		event?.preventDefault();
		if (!formIsValid()) return alert('Amount must be bigger than 0 and less than balance.');
		onSuccess({ amount: Number.parseFloat(amount), token: max as TokenDropdownType });
	};

	const handleMaxClicked = () => {
		if (!max?.amount) return;
		const tokenAmount = Number(max.amount) / Math.pow(10, 6);
		setAmount(tokenAmount.toString());
	};

	return (
		<>
			<Header pageTitle={config.pageTitle} header={header} />

			<main className={cls(utilsStyles.main, utilsStyles.columnJustifyCenter, styles.stepContainer)}>
				<div className={utilsStyles.spacer} />
				{!validator ? (
					<IconText text="Something went wrong. Please try again." Img={SadFace} imgSize={50} />
				) : wallet.balances?.balances?.length ? (
					<form className={styles.stepsForm} onSubmit={handleSubmit} autoComplete="none">
						{delegated && (
							<>
								<ValidatorListItem validator={validator} onClick={() => () => {}} />
								<div className={utilsStyles.spacer} />
							</>
						)}
						<p>{delegated ? config.label : config.defaultLabel}</p>
						<div className={styles.inputRow}>
							<div className={styles.amountWrapper}>
								<p className={cls(styles.subtext, styles.alignRight)} onClick={handleMaxClicked}>
									Max: {max ? `${formatTokenAmount(Number(max.amount))} ${max.label}` : '-'}
								</p>
								<Input name="walletAddress" type="number" required onChange={handleChange} value={amount} className={cls(styles.stepInput, styles.alignRight)} />
							</div>
							<div className={styles.tokenWrapper}>IXO</div>
						</div>
						{config.sub ? <p>{config.sub}</p> : null}
						<div className={utilsStyles.spacer} />
					</form>
				) : (
					<IconText text="You don't have any tokens to stake." Img={SadFace} imgSize={50} />
				)}

				<Footer onBack={onBack} onBackUrl={onBack ? undefined : ''} onCorrect={formIsValid() ? () => handleSubmit(null) : null} />
			</main>
		</>
	);
};

export default DefineAmountDelegate;
