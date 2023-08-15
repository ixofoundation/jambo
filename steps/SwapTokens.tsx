import { FC, useState, useContext } from 'react';
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

const SwapTokens: FC<SwapTokensProps> = ({ onSuccess, onBack, config, data, header, loading = false, signedIn = true }) => {
  const [amount, setAmount] = useState(
    data?.data ? data.data[data.currentIndex ?? data.data.length - 1]?.amount?.toString() ?? '' : '',
  );
  const [selectedOption, setSelectedOption] = useState<CURRENCY_TOKEN | undefined>();
  const { wallet, fetchAssets } = useContext(WalletContext);
  const navigateToAccount = () => pushNewRoute('/account');
  const [toggleSliderAction, setToggleSliderAction] = useState(false)
  const toggleSlider = () => {
    setToggleSliderAction(!toggleSliderAction);
  }
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
                        className={cls(styles.stepInput)}
                        onMaxClick={(maxAmount) => setAmount(maxAmount.toString())}
                        required
                      />
                    </div>
                    <div className={utilsStyles.paddingToken} >
                      <TokenSelector
                        value={selectedOption as CURRENCY_TOKEN}
                        onChange={setSelectedOption}
                        options={wallet.balances?.data ?? []}
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
                        type='number'
                        className={cls(styles.stepInput)}
                      />
                    </div>
                    <div className={utilsStyles.paddingTop} >
                      <TokenSelector
                        value={selectedOption as CURRENCY_TOKEN}
                        onChange={setSelectedOption}
                        options={wallet.balances?.data ?? []}
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
        onCorrect={null}
      />
    </>
  );
};

export default SwapTokens;

