import { ChangeEvent, FormEvent, useContext, useEffect, useState, FC } from 'react';
import cls from 'classnames';
import utilsStyles from '@styles/utils.module.scss';
import styles from '@styles/stepsPages.module.scss';
import TokenSelector from '@components/TokenSelector/TokenSelector';
import { InputWithMax } from '@components/Input/Input';
import IconText from '@components/IconText/IconText';
import Header from '@components/Header/Header';
import Footer from '@components/Footer/Footer';
import SadFace from '@icons/sad_face.svg';
import {
  validateAmountAgainstBalance,
  microAmountToAmount,
  amountToMicroAmount,
  getDecimalsFromCurrencyToken,
  getAmountFromCurrencyToken,
} from '@utils/currency';
import { StepConfigType, StepDataType, STEPS } from 'types/steps';
import { WalletContext } from '@contexts/wallet';
import { CURRENCY_TOKEN } from 'types/wallet';

type DefineAmountTokenProps = {
  onSuccess: (data: StepDataType<STEPS.select_token_and_amount>) => void;
  onBack?: () => void;
  config?: StepConfigType<STEPS.select_token_and_amount>;
  data?: StepDataType<STEPS.select_token_and_amount>;
  header?: string;
};

const calculateRemainingMax = (currentToken: CURRENCY_TOKEN, prevData: StepDataType<STEPS.select_token_and_amount>) => {
  if (!currentToken) return 0;
  const result: number = (prevData.data ?? []).reduce(
    (acc: number, curr: { token: CURRENCY_TOKEN; amount: number }): number => {
      const { amount, token } = curr;
      if (token.token?.coinDenom !== currentToken.denom && token.token?.coinMinimalDenom !== currentToken.denom)
        return acc;
      return acc - amount;
    },
    microAmountToAmount(getAmountFromCurrencyToken(currentToken), getDecimalsFromCurrencyToken(currentToken)),
  );
  return amountToMicroAmount(result, getDecimalsFromCurrencyToken(currentToken));
};

const DefineAmountToken: FC<DefineAmountTokenProps> = ({ onSuccess, onBack, config, data, header }) => {
  const [amount, setAmount] = useState(
    data?.data ? data.data[data.currentIndex ?? data.data.length - 1]?.amount?.toString() ?? '' : '',
  );
  const [selectedOption, setSelectedOption] = useState<CURRENCY_TOKEN | undefined>();
  const { wallet, fetchAssets } = useContext(WalletContext);
  const [displayAmount, setDisplayAmount] = useState<number>(999999999);
  const [errorMessage, setErrorMessage] = useState('');
  const [inputValue1, setInputValue1] = useState('');

  const handleAmountChange = (newAmount: number) => {
    console.log(`handleAmountChange called with: ${newAmount}`);
    setDisplayAmount(newAmount);
  };

  useEffect(() => {
    fetchAssets();
  }, []);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const newValue = Number(event.target.value);
    let aamount = Number(displayAmount);
    if (newValue > aamount) {
      setErrorMessage('The input value cannot exceed the maximum amount.');
      setInputValue1(aamount.toString());
    } else {
      setErrorMessage('');
      //  setInputValue(event.target.value);
    }

    if (newValue < 0) {
      setErrorMessage('The amount cannot be negative.');
      //  setInputValue('0');
      return;
    }
    setInputValue1(event.target.value);
  };

  const formIsValid = () =>
    config?.optional ||
    (!!selectedOption &&
      Number.parseFloat(amount) > 0 &&
      validateAmountAgainstBalance(Number.parseFloat(amount), Number(selectedOption.amount)));

  const handleSubmit = (event: FormEvent<HTMLFormElement> | null) => {
    event?.preventDefault();
    if (!formIsValid()) return alert('A token is required and amount must be bigger than 0 and less than balance.');
    const newData = {
      amount: Number(inputValue1),
      token: selectedOption!,
    };
    const isEditing = !!data?.data[data?.currentIndex];
    onSuccess(
      !isEditing
        ? { ...data, currentIndex: 0, data: [...(data?.data ?? []), newData] }
        : {
            ...data,
            data: [...data.data.slice(0, data.currentIndex), newData, ...data.data.slice(data.currentIndex + 1)],
          },
    );
  };

  return (
    <>
      <Header header={header} />

      <main className={cls(utilsStyles.main, utilsStyles.columnJustifyCenter, styles.stepContainer)}>
        {wallet.balances?.data ? (
          <form className={styles.stepsForm} onSubmit={handleSubmit} autoComplete='none'>
            <p className={styles.label}>{config?.denomLabel ?? 'Select token to sent'}</p>
            <TokenSelector
              value={selectedOption as CURRENCY_TOKEN}
              onChange={setSelectedOption}
              options={wallet.balances?.data ?? []}
            />
            <br />
            <p className={cls(styles.label, styles.titleWithSubtext)}>
              {config?.amountLabel ?? 'Enter an amount to send'}
            </p>
            <InputWithMax
              onAmountChange={handleAmountChange}
              maxAmount={calculateRemainingMax(selectedOption!, data!)}
              maxToken={selectedOption}
              onMaxClick={(maxAmount) => setAmount(maxAmount.toString())}
              name='walletAddress'
              type='number'
              required
              onChange={handleChange}
              value={amount}
              className={cls(styles.stepInput, styles.alignRight)}
            />
            {/* <p> the amount is {displayAmount}</p> */}
            {errorMessage && <p className={styles.error}>{errorMessage}</p>}
          </form>
        ) : (
          <IconText title="You don't have any tokens to send." Img={SadFace} imgSize={50} />
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

export default DefineAmountToken;
