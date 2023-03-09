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
import { validateAmountAgainstBalance } from '@utils/currency';
import { StepDataType, STEPS } from 'types/steps';
import { WalletContext } from '@contexts/wallet';
import { CURRENCY_TOKEN } from 'types/wallet';

type DefineAmountTokenProps = {
  onSuccess: (data: StepDataType<STEPS.select_token_and_amount>) => void;
  onBack?: () => void;
  data?: StepDataType<STEPS.select_token_and_amount>;
  header?: string;
};

const DefineAmountToken: FC<DefineAmountTokenProps> = ({ onSuccess, onBack, data, header }) => {
  const [amount, setAmount] = useState(
    data?.data ? data.data[data.currentIndex ?? data.data.length - 1]?.amount?.toString() ?? '' : '',
  );
  const [selectedOption, setSelectedOption] = useState<CURRENCY_TOKEN | undefined>();
  const { wallet, fetchAssets } = useContext(WalletContext);

  useEffect(() => {
    fetchAssets();
  }, []);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    let newAmount = event.target.value;
    // cannot use thousands separators
    // newAmount = formatTokenAmount(formattedAmountToNumber(newAmount), getDecimalsFromCurrencyToken(selectedOption));
    setAmount(newAmount);
  };

  const formIsValid = () =>
    !!selectedOption &&
    Number.parseFloat(amount) > 0 &&
    validateAmountAgainstBalance(Number.parseFloat(amount), Number(selectedOption.amount));

  const handleSubmit = (event: FormEvent<HTMLFormElement> | null) => {
    event?.preventDefault();
    if (!formIsValid()) return alert('A token is required and amount must be bigger than 0 and less than balance.');
    const newData = {
      amount: Number(amount),
      token: selectedOption!,
    };
    const isEditing = !!data?.data[data?.currentIndex];
    onSuccess(
      !isEditing
        ? { ...data, currentIndex: 0, data: [...(data?.data ?? []), newData] }
        : {
            ...data,
            data: [...data.data.slice(0, data.currentIndex), newData, ...data.data.slice(0, data.currentIndex)],
          },
    );
  };

  return (
    <>
      <Header header={header} />

      <main className={cls(utilsStyles.main, utilsStyles.columnJustifyCenter, styles.stepContainer)}>
        {wallet.balances?.balances ? (
          <form className={styles.stepsForm} onSubmit={handleSubmit} autoComplete='none'>
            <p className={styles.label}>Select token to sent</p>
            <TokenSelector
              value={selectedOption as CURRENCY_TOKEN}
              onChange={setSelectedOption}
              options={wallet.balances?.balances ?? []}
            />
            <br />
            <p className={cls(styles.label, styles.titleWithSubtext)}>Enter an amount to send</p>
            <InputWithMax
              maxToken={selectedOption}
              onMaxClick={(maxAmount) => setAmount(maxAmount.toString())}
              name='walletAddress'
              type='number'
              required
              onChange={handleChange}
              value={amount}
              className={cls(styles.stepInput, styles.alignRight)}
            />
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
