import { FC, useState, useContext, ChangeEvent } from 'react';
import cls from 'classnames';
import utilsStyles from '@styles/utils.module.scss';
import styles from '@styles/stepsPages.module.scss';
import WalletCard from '@components/CardWallet/CardWallet';
import Header from '@components/Header/Header';
import Footer from '@components/Footer/Footer';
import Loader from '@components/Loader/Loader';
import Slider from '@components/Slider/Slider'
import WalletImg from '@icons/wallet.svg';
import { pushNewRoute } from '@utils/router';
import { StepConfigType, StepDataType, STEPS } from 'types/steps';
import TokenSelector from '@components/TokenSelector/TokenSelector';
import { CURRENCY_TOKEN } from 'types/wallet';
import { WalletContext } from '@contexts/wallet';
import { ChainContext } from '@contexts/chain';
import { AmountType, pools, TokenAmount, tokens, TokenSelect, TokenType } from '@constants/pools';
import Input, { InputWithMax } from '@components/Input/Input';
import { TRX_MSG } from 'types/transactions';
import { validateAmountAgainstBalance } from '@utils/currency';
import { generateSwapTrx } from '@utils/transactions';

type SwapTokensProps = {
  onSuccess: (data: StepDataType<STEPS.swap_tokens>) => void;
  onBack?: () => void;
  data?: StepDataType<STEPS.select_token_and_amount>;
  config?: StepConfigType<STEPS.swap_tokens>;
  header?: string;
  loading?: boolean;
  signedIn?: boolean;
};

const SwapTokens: FC<SwapTokensProps> = ({
  onSuccess,
  onBack,
  config,
  data,
  header,
  loading = false,
  signedIn = true,
}) => {
  const [inputAmount, setInputAmount] = useState(
    data?.data ? data.data[data.currentIndex ?? data.data.length - 1]?.amount?.toString() ?? '' : '',
  );
  const [outputAmount, setOutputAmount] = useState(
    data?.data ? data.data[data.currentIndex ?? data.data.length - 1]?.amount?.toString() ?? '' : '',
  );
  const [inputToken, setInputToken] = useState<CURRENCY_TOKEN | undefined>();
  const [outputToken, setOutputToken] = useState<CURRENCY_TOKEN | undefined>();
  const [toggleSliderAction, setToggleSliderAction] = useState(false);
  const [slippage, setSlippage] = useState(1);

  const { wallet, fetchAssets } = useContext(WalletContext);
  const { queryClient } = useContext(ChainContext);

  const navigateToAccount = () => pushNewRoute('/account');
  const handleSlippageChange = (event: { target: { value: string } }) => {
    const newSlippage = parseInt(event.target.value);
    setSlippage(newSlippage);
  };
  const toggleSlider = () => {
    setToggleSliderAction(!toggleSliderAction);
  };
  const getTokenOptions = (): CURRENCY_TOKEN[] => {
    const walletBalancesOptions = wallet.balances?.data ?? [];
    const walletTokensOptions = wallet.tokenBalances?.data ?? [];

    return [...walletBalancesOptions.filter((balance) => tokens.has(balance.denom)), ...walletTokensOptions];
  };
  const handleInputAmountChange = (event: ChangeEvent<HTMLInputElement>) => {
    setInputAmount(event.target.value);
  };
  const handleOutputAmountChange = (event: ChangeEvent<HTMLInputElement>) => {
    setOutputAmount(event.target.value);
  };
  const handleInputTokenChange = (token: CURRENCY_TOKEN) => {
    if (token == outputToken) {
      setOutputToken(inputToken);
    }

    setInputToken(token);
  };
  const handleOutputTokenChange = (token: CURRENCY_TOKEN) => {
    if (token == inputToken) {
      setInputToken(outputToken);
    }

    setOutputToken(token);
  };
  const formIsValid = () => {
    const inputValid =
      !!inputToken &&
      Number.parseFloat(inputAmount) > 0 &&
      validateAmountAgainstBalance(Number.parseFloat(inputAmount), Number(inputToken.amount), false);
    const outputValid = !!outputToken && Number.parseFloat(outputAmount) > 0;

    return inputValid && outputValid;
  };

  const signTX = async (): Promise<void> => {
    if (!inputToken || !outputToken) return;

    const inputTokenSelect =
      tokens.get(inputToken.denom)?.type === TokenType.Cw1155 ? TokenSelect.Token1155 : TokenSelect.Token2;
    const contractAddress =
      inputTokenSelect === TokenSelect.Token1155
        ? pools.get({ token1155: inputToken.denom, token2: outputToken?.denom })
        : pools.get({ token1155: outputToken.denom, token2: inputToken?.denom });

    let totalInputAmountRest = Number(inputAmount);
    let inputTokenBatches = new Map<string, string>();
    for (const [tokenId, amount] of inputToken?.batches!) {
      const tokenAmount = Number(amount);

      if (tokenAmount > totalInputAmountRest) {
        inputTokenBatches.set(tokenId, totalInputAmountRest.toString());
        totalInputAmountRest = 0;
      } else {
        inputTokenBatches.set(tokenId, amount);
        totalInputAmountRest -= tokenAmount;
      }

      if (!totalInputAmountRest) return;
    }

    console.log(inputTokenBatches);

    const inputTokenAmount: TokenAmount =
      inputTokenSelect === TokenSelect.Token1155 ? { multiple: new Map<string, string>() } : { single: '123' };
    const outputTokenAmount: TokenAmount =
      inputTokenSelect === TokenSelect.Token1155 ? { single: '123' } : { multiple: new Map<string, string>() };
    const trx = generateSwapTrx({ contractAddress, inputTokenSelect });
  };

  return (
    <>
      <Header />
      <main className={cls(utilsStyles.main, utilsStyles.columnJustifyCenter, styles.stepContainer)}>
        <div className={utilsStyles.spacer3} />
        {loading ? (
          <Loader />
        ) : !signedIn ? (
          <WalletCard name='Connect your Wallet' Img={WalletImg} onClick={navigateToAccount} />
        ) : (
          <div className='mainInterface'>
            {toggleSliderAction ? (
              <div>
                <Slider />
              </div>
            ) : (
              <form className={styles.stepsForm} autoComplete='none' >
                {/* I want to swap */}
                <div className={utilsStyles.columnAlignCenter} >
                  <p className={cls(styles.label, styles.titleWithSubtext)}>I want to swap</p>
                  <div className={utilsStyles.rowAlignCenter}>
                    <div>
                      <InputWithMax
                        maxToken={inputToken}
                        onMaxClick={(maxAmount) => setInputAmount(maxAmount.toString())}
                        name='walletAddress'
                        type='number'
                        required
                        value={inputAmount}
                        className={cls(styles.stepInput)}
                        onChange={handleInputAmountChange}
                      />
                    </div>
                    <div className={utilsStyles.paddingToken} >
                      <TokenSelector
                        value={inputToken as CURRENCY_TOKEN}
                        onChange={handleInputTokenChange}
                        options={getTokenOptions()}
                        displaySwapOptions
                      />
                    </div>
                  </div>
                </div>
                {/* For */}
                <div className={utilsStyles.columnAlignCenter} >
                  <p className={cls(styles.label, styles.titleWithSubtext)}>for</p>
                  <div className={utilsStyles.rowAlignCenter} >
                    <div>
                      <Input
                        name='walletAddress'
                        type='number'
                        required
                        value={outputAmount}
                        className={cls(styles.stepInput)}
                        onChange={handleOutputAmountChange}
                      />
                    </div>
                    <div className={utilsStyles.paddingTop} >
                      <TokenSelector
                        value={outputToken as CURRENCY_TOKEN}
                        onChange={handleOutputTokenChange}
                        options={getTokenOptions()}
                        displaySwapOptions
                      />
                    </div>
                  </div>
                </div>
              </form>
            )
            }
          </div>
        )}
        <div className={utilsStyles.spacer3} />
      </main>

      <Footer
        sliderActionButton={toggleSlider}
        onBack={onBack}
        onBackUrl={onBack ? undefined : ''}
        backLabel='Home'
        onCorrect={formIsValid() ? signTX : null}
      />
    </>
  );
};

export default SwapTokens;

