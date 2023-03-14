import { ChangeEvent, FormEvent, useContext, useEffect, useState, FC } from 'react';
import cls from 'classnames';

import utilsStyles from '@styles/utils.module.scss';
import styles from '@styles/stepsPages.module.scss';
import TokenSelector from '@components/TokenSelector/TokenSelector';
import Input, { InputWithMax } from '@components/Input/Input';
import IconText from '@components/IconText/IconText';
import Header from '@components/Header/Header';
import Footer from '@components/Footer/Footer';
import SadFace from '@icons/sad_face.svg';
import {
  calculateMaxTokenAmount,
  getAmountFromCurrencyToken,
  getDenomFromCurrencyToken,
  validateAmountAgainstBalance,
} from '@utils/currency';
import { StepDataType, STEPS } from 'types/steps';
import { WalletContext } from '@contexts/wallet';
import { CURRENCY_TOKEN } from 'types/wallet';
import Slippage from '@components/Slippage/Slippage';
import useModalState from '@hooks/useModalState';
import AmountAndDenom from '@components/AmountAndDenom/AmountAndDenom';

type DefineSwapAmountTokenProps = {
  onSuccess: (data: StepDataType<STEPS.select_swap_tokens_and_amount>) => void;
  onBack?: () => void;
  data?: StepDataType<STEPS.select_swap_tokens_and_amount>;
  header?: string;
};

const DUMMY_CHAIN_DATA: CURRENCY_TOKEN[] = [
  {
    denom: 'ibc/05AC4BBA78C5951339A47DD1BC1E7FC922A9311DF81C85745B1C162F516FF2F1',
    amount: '4000000',
    ibc: true,
    token: {
      coinDenom: 'OSMO',
      coinMinimalDenom: 'uosmo',
      coinDecimals: 6,
      coinGeckoId: 'osmosis',
      isStakeCurrency: true,
      isFeeCurrency: true,
      coinImageUrl: 'https://raw.githubusercontent.com/chainapsis/keplr-chain-registry/main/images/osmosis/chain.png',
    },
  },
  {
    denom: 'ujuno',
    amount: '15000000',
    ibc: false,
    token: {
      coinDenom: 'JUNO',
      coinMinimalDenom: 'ujuno',
      coinDecimals: 6,
      coinGeckoId: 'ixo',
      isStakeCurrency: true,
      isFeeCurrency: true,
      coinImageUrl: 'https://raw.githubusercontent.com/chainapsis/keplr-chain-registry/main/images/juno/chain.png',
    },
  },
  {
    denom: 'usdc',
    amount: '11000000',
    ibc: false,
    token: {
      coinDenom: 'USDC',
      coinMinimalDenom: 'usdc',
      coinDecimals: 6,
      coinGeckoId: 'ixo',
      isStakeCurrency: true,
      isFeeCurrency: true,
      coinImageUrl: 'https://raw.githubusercontent.com/chainapsis/keplr-chain-registry/main/images/juno/chain.png',
    },
  },
];

const DefineSwapAmountToken: FC<DefineSwapAmountTokenProps> = ({ onSuccess, onBack, data, header }) => {
  const [slippageVisible, showSlippage, hideSlippage] = useModalState(false);
  const [fromToken, setFromToken] = useState<CURRENCY_TOKEN | undefined>();
  const [fromAmount, setFromAmount] = useState<string>();
  const [toToken, setToToken] = useState<CURRENCY_TOKEN | undefined>();
  const [toAmount, setToAmount] = useState<string>();
  // const [selectedOption, setSelectedOption] = useState<CURRENCY_TOKEN | null>(data?.token || null);
  const { wallet, fetchAssets } = useContext(WalletContext);

  useEffect(() => {
    fetchAssets();
  }, []);

  const updateFromAmount = (amount: string | number) => setFromAmount(amount.toString());
  const handleFromAmountChange = (event: ChangeEvent<HTMLInputElement>) => updateFromAmount(event.target.value);

  const updateToAmount = (amount: string | number) => setToAmount(amount.toString());
  const handleToAmountChange = (event: ChangeEvent<HTMLInputElement>) => updateToAmount(event.target.value);

  const formIsValid = () =>
    !!fromToken &&
    !!toToken &&
    Number.parseFloat(toAmount ?? '0') > 0 &&
    validateAmountAgainstBalance(Number.parseFloat(fromAmount ?? '0'), Number(fromToken.amount));

  const handleSubmit = (event: FormEvent<HTMLFormElement> | null) => {
    event?.preventDefault();
    if (!formIsValid()) return alert('A token is required and amount must be bigger than 0 and less than balance.');
    onSuccess({
      from: { amount: Number.parseFloat(fromAmount!), token: fromToken! },
      to: { amount: Number.parseFloat(toAmount!), token: toToken! },
    });
  };

  // TODO: use current chain fee currency as fee currency
  // TODO: pull in actual slippage on slippage screen
  // TODO: use dollar worths
  // TODO: when update fromAmount, the auto update toAmount and vice versa
  return (
    <>
      <Header header={header} />

      <main className={cls(utilsStyles.main, utilsStyles.columnJustifyCenter, styles.stepContainer)}>
        {wallet.balances?.data ? (
          <form className={styles.stepsForm} onSubmit={handleSubmit} autoComplete='none'>
            <p>I want to swap</p>
            <div className={utilsStyles.rowAlignEnd}>
              <InputWithMax
                maxToken={fromToken}
                onMaxClick={updateFromAmount}
                onChange={handleFromAmountChange}
                value={fromAmount}
                align='center'
                style={{ fontSize: '1rem' }}
              />
              <div style={{ width: 10 }} />
              <TokenSelector tokens={wallet.balances.data} onTokenSelect={setFromToken} value={fromToken} />
            </div>
            <p>for</p>
            <div className={utilsStyles.rowAlignEnd}>
              <Input value={toAmount} align='center' style={{ fontSize: '1rem' }} onChange={handleToAmountChange} />
              <div style={{ width: 10 }} />
              <TokenSelector tokens={DUMMY_CHAIN_DATA} onTokenSelect={setToToken} value={toToken} />
            </div>
            <br />
            <div className={utilsStyles.rowAlignSpaceBetween}>
              <p>Transaction Fee:</p>
              <p>0.33% (0.1 IXO) ≈ $1.49</p>
            </div>
            <div className={utilsStyles.rowAlignSpaceBetween}>
              <p>Estimated Slippage:</p>
              <p>0.15 %</p>
            </div>
          </form>
        ) : slippageVisible ? (
          <form className={styles.stepsForm} autoComplete='none'>
            <Slippage />
          </form>
        ) : (
          <IconText title="You don't have any tokens to swap." Img={SadFace} imgSize={50} />
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

export default DefineSwapAmountToken;
