import { FC, useState, useContext, ChangeEvent } from 'react';
import cls from 'classnames';
// import { useRouter } from 'next/router';
import utilsStyles from '@styles/utils.module.scss';
import styles from '@styles/stepsPages.module.scss';
import WalletCard from '@components/CardWallet/CardWallet';
import Header from '@components/Header/Header';
import Footer from '@components/Footer/Footer';
import Loader from '@components/Loader/Loader';
import WalletImg from '@icons/wallet.svg';
import { pushNewRoute } from '@utils/router';
import { StepConfigType, StepDataType, STEPS } from 'types/steps';
import TokenSelector from '@components/TokenSelector/TokenSelector';
import { CURRENCY_TOKEN } from 'types/wallet';
import { WalletContext } from '@contexts/wallet';
import { ChainContext } from '@contexts/chain';
import { tokens } from '@constants/pools';
import Input, { InputWithMax } from '@components/Input/Input';

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

  const Hugstyles = {
    height: '40px',
    width: '40px',
    backgroundColor: '#F0F0F0',
    borderRadius: '20px',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    margin: '0px 8px 0px 8px',
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
                <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
                  <p>
                    Set max slippage to <span style={{ color: '#1DB3D3' }}>{slippage}%</span>
                  </p>
                </div>
                <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
                  <div className='hug_1' style={Hugstyles}>
                    1%
                  </div>
                  <div className='hug_2' style={Hugstyles}>
                    2%
                  </div>
                  <div className='hug_3' style={Hugstyles}>
                    3%
                  </div>
                  <div className='hug_4' style={Hugstyles}>
                    5%
                  </div>
                </div>
                <input
                  style={{ width: '268px', padding: '20px 0px 20px 0px' }}
                  type='range'
                  id='slippageSlider'
                  min={1}
                  max={5}
                  step={1}
                  value={slippage}
                  onChange={handleSlippageChange}
                />
              </div>
            ) : (
              <div>
                {/* I want to swap */}
                <div style={{ textAlign: 'center' }}>
                  <p>I want to swap</p>
                  <div
                    className='container'
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div
                      className='amount'
                      style={{
                        margin: '10px',
                        height: '46px',
                        width: '163px',
                        borderRadius: '23px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center',
                      }}
                    >
                      <InputWithMax
                        maxToken={inputToken}
                        onMaxClick={(maxAmount) => setInputAmount(maxAmount.toString())}
                        name='walletAddress'
                        type='number'
                        required
                        value={inputAmount}
                        className={cls(styles.swapInput, styles.alignRight)}
                        onChange={handleInputAmountChange}
                      />
                    </div>
                    <div
                      className='token'
                      style={{
                        backgroundColor: '#F0F0F0',
                        margin: '10px',
                        height: '46px',
                        width: '140px',
                        borderRadius: '23px',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                      }}
                    >
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
                <div style={{ textAlign: 'center' }}>
                  <p>for</p>
                  <div
                    className='container'
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div
                      className='amount'
                      style={{
                        backgroundColor: '#F0F0F0',
                        margin: '10px',
                        height: '46px',
                        width: '163px',
                        borderRadius: '23px',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                      }}
                    >
                      <Input
                        name='walletAddress'
                        type='number'
                        required
                        value={outputAmount}
                        className={cls(styles.stepInput, styles.alignRight)}
                        onChange={handleOutputAmountChange}
                      />
                    </div>
                    <div
                      className='token'
                      style={{
                        backgroundColor: '#F0F0F0',
                        margin: '10px',
                        height: '46px',
                        width: '140px',
                        borderRadius: '23px',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                      }}
                    >
                      <TokenSelector
                        value={outputToken as CURRENCY_TOKEN}
                        onChange={handleOutputTokenChange}
                        options={getTokenOptions()}
                        displaySwapOptions
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        <div className={utilsStyles.spacer3} />
      </main>

      <Footer sliderActionButton={toggleSlider} onBackUrl='/' backLabel='Home' onCorrect={null} />
    </>
  );
};

export default SwapTokens;
