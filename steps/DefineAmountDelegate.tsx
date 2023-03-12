import { ChangeEvent, FormEvent, useContext, useEffect, useState, FC } from 'react';
import cls from 'classnames';

import utilsStyles from '@styles/utils.module.scss';
import styles from '@styles/stepsPages.module.scss';
import ValidatorListItem from '@components/ValidatorListItem/ValidatorListItem';
import IconText from '@components/IconText/IconText';
import Header from '@components/Header/Header';
import Footer from '@components/Footer/Footer';
import Input from '@components/Input/Input';
import SadFace from '@icons/sad_face.svg';
import { VALIDATOR, VALIDATOR_AMOUNT_CONFIG } from 'types/validators';
import { StepDataType, STEPS } from 'types/steps';
import { CURRENCY_TOKEN } from 'types/wallet';
import { WalletContext } from '@contexts/wallet';
import {
  calculateMaxTokenAmount,
  calculateTokenAmount,
  validateAmountAgainstBalance,
  generateUserTokensDropdown,
  getDisplayDenomFromCurrencyToken,
} from '@utils/currency';

type DefineAmountTokenProps = {
  onSuccess: (data: StepDataType<STEPS.select_amount_delegate>) => void;
  onBack?: () => void;
  data?: StepDataType<STEPS.select_amount_delegate>;
  header?: string;
  validator: VALIDATOR | null;
  config: VALIDATOR_AMOUNT_CONFIG;
};

const determineDelegationBalance = (
  source: 'wallet' | 'validator',
  walletBalances: CURRENCY_TOKEN | undefined,
  validatorBalance: CURRENCY_TOKEN | undefined,
): CURRENCY_TOKEN | undefined => {
  const ixoCurrency = source === 'wallet' ? walletBalances : source === 'validator' ? validatorBalance : undefined;
  return ixoCurrency;
};

const DefineAmountDelegate: FC<DefineAmountTokenProps> = ({ onSuccess, onBack, data, header, validator, config }) => {
  const delegated = !!validator?.delegation?.shares;
  const [amount, setAmount] = useState(data?.amount.toString() ?? '');
  const [max, setMax] = useState<CURRENCY_TOKEN | undefined>();
  const { wallet, fetchAssets } = useContext(WalletContext);

  useEffect(() => {
    if (config.source === 'wallet') fetchAssets();
  }, []);

  useEffect(() => {
    const currentCurrency = determineDelegationBalance(
      config.source,
      wallet?.balances?.data?.find((balance) => balance?.token?.isStakeCurrency),
      validator?.delegation?.balance,
    );
    if (currentCurrency?.amount !== max?.amount) setMax(currentCurrency);
  }, [config.source, wallet.balances?.data, validator?.delegation?.balance]);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    setAmount(event.target.value);
  };

  const formIsValid = () =>
    !!max &&
    Number.parseFloat(amount) > 0 &&
    validateAmountAgainstBalance(Number.parseFloat(amount), Number(max.amount));

  const handleSubmit = (event: FormEvent<HTMLFormElement> | null) => {
    event?.preventDefault();
    if (!formIsValid()) return alert('Amount must be bigger than 0 and less than balance.');
    onSuccess({ amount: Number(amount), token: max! });
  };

  const handleMaxClicked = () => {
    if (!max?.amount) return;
    const tokenAmount = calculateTokenAmount(Number(max.amount), 6, config.source === 'wallet');
    setAmount(tokenAmount.toString());
  };

  return (
    <>
      <Header header={header} />

      <main className={cls(utilsStyles.main, utilsStyles.columnJustifyCenter, styles.stepContainer)}>
        <div className={utilsStyles.spacer3} />
        {!validator ? (
          <IconText title='Something went wrong. Please try again.' Img={SadFace} imgSize={50} />
        ) : wallet.balances?.data?.length ? (
          <form className={styles.stepsForm} onSubmit={handleSubmit} autoComplete='none'>
            {delegated && (
              <>
                <ValidatorListItem validator={validator} onClick={() => () => {}} />
                <div className={utilsStyles.spacer3} />
              </>
            )}
            <p>{delegated ? config.label : config.defaultLabel}</p>
            <div className={styles.inputRow}>
              {' '}
              {
                // TODO: use InputWithMax
              }
              <div className={styles.amountWrapper}>
                <p className={cls(styles.subtext, styles.alignRight)} onClick={handleMaxClicked}>
                  {calculateMaxTokenAmount(Number(max?.amount ?? 0), 6, config.source === 'wallet')}{' '}
                  {getDisplayDenomFromCurrencyToken(max)} MAX
                </p>
                <Input
                  name='walletAddress'
                  type='number'
                  required
                  onChange={handleChange}
                  value={amount}
                  className={cls(styles.stepInput, styles.alignRight)}
                />
              </div>
              <Input
                name='token'
                required
                value={getDisplayDenomFromCurrencyToken(max)}
                disabled
                className={styles.tokenInput}
                size={8}
              />
            </div>

            <div className={utilsStyles.spacer3} />
            {config.sub ? <p className={styles.caption}>{config.sub}</p> : null}
          </form>
        ) : (
          <IconText title="You don't have any tokens to stake." Img={SadFace} imgSize={50} />
        )}
      </main>

      <Footer
        onBack={onBack}
        onBackUrl={onBack ? undefined : ''}
        onForward={formIsValid() ? () => handleSubmit(null) : null}
      />
    </>
  );
};

export default DefineAmountDelegate;
