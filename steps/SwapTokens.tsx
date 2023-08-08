import { FC, useState, useContext } from 'react';
import cls from 'classnames';
import { useRouter } from 'next/router';
import utilsStyles from '@styles/utils.module.scss';
import styles1 from '@styles/stepsPages.module.scss';
import WalletCard from '@components/CardWallet/CardWallet';
import Header from '@components/Header/Header';
// import Footer from '@components/Footer/Footer';
import Loader from '@components/Loader/Loader';
import WalletImg from '@icons/wallet.svg';
import { pushNewRoute } from '@utils/router';
import { StepConfigType, StepDataType, STEPS } from 'types/steps';
import TokenSelector from '@components/TokenSelector/TokenSelector';
import { CURRENCY_TOKEN } from 'types/wallet';
import { WalletContext } from '@contexts/wallet';
import styles from '../components/Footer/Footer.module.scss';
import ButtonRound, { BUTTON_ROUND_COLOR, BUTTON_ROUND_SIZE } from '@components/ButtonRound/ButtonRound';
import ColoredIcon, { ICON_COLOR } from '@components/ColoredIcon/ColoredIcon';
import Anchor from '@components/Anchor/Anchor';
import ArrowRight from '@icons/arrow_right.svg';
import ArrowLeft from '@icons/arrow_left.svg';
import Correct from '@icons/correct.svg';
import Wallet from '@icons/wallet.svg';
import Touch from '@icons/touch.svg';
import Slider from '@icons/slider.svg';
// import useWindowDimensions from '@hooks/windowDimensions';
import { backRoute, replaceRoute } from '@utils/router';

type SwapTokensProps = {
  onSuccess: (data: StepDataType<STEPS.swap_tokens>) => void;
  onBack?: () => void;
  data?: StepDataType<STEPS.select_token_and_amount>;
  config?: StepConfigType<STEPS.swap_tokens>;
  header?: string;
  loading?: boolean;
  signedIn?: boolean;
};

type FooterProps = {
  onBackUrl?: string;
  onBack?: (() => void) | null;
  backLabel?: string;
  onCorrect?: (() => void) | null;
  correctLabel?: string;
  onForward?: (() => void) | null;
  forwardLabel?: string;
  showAccountButton?: boolean;
  showActionsButton?: boolean;
  sliderActionButton?: (() => void) | null;
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
  const [slippage, setSlippage] = useState(1);

  const handleSlippageChange = (event: { target: { value: string; }; }) => {
    const newSlippage = parseInt(event.target.value);
    setSlippage(newSlippage);
  };

  const Hugstyles = {
    height: "40px",
    width: "40px",
    backgroundColor: "#F0F0F0",
    borderRadius: "20px",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: "0px, 8rem, 0px, 8rem"
  }

  const Footer = ({
    onBack,
    // backLabel,
    onBackUrl,
    onCorrect,
    // correctLabel,
    onForward,
    // forwardLabel,
    showAccountButton,
    showActionsButton,
    sliderActionButton,
  }: FooterProps) => {
    // const { width } = useWindowDimensions();
    const { asPath } = useRouter();

    return (
      <footer className={styles.footer}>
        {showAccountButton && (
          <Anchor href='/account' active={asPath !== '/account'}>
            <ButtonRound
              size={BUTTON_ROUND_SIZE.large}
              color={/^\/account/i.test(asPath) ? BUTTON_ROUND_COLOR.primary : BUTTON_ROUND_COLOR.lightGrey}
            >
              <ColoredIcon
                icon={Wallet}
                size={24}
                color={/^\/account/i.test(asPath) ? ICON_COLOR.white : ICON_COLOR.primary}
              />
              {/* {!!width && width > 425 && <p className={styles.label}>Account</p>} */}
            </ButtonRound>
          </Anchor>
        )}
        {showActionsButton && (
          <Anchor href='/' active={asPath !== '/'}>
            <ButtonRound
              size={BUTTON_ROUND_SIZE.large}
              color={asPath === '/' ? BUTTON_ROUND_COLOR.primary : BUTTON_ROUND_COLOR.lightGrey}
            >
              <ColoredIcon icon={Touch} size={24} color={asPath === '/' ? ICON_COLOR.white : ICON_COLOR.primary} />
            </ButtonRound>
          </Anchor>
        )}
        {(onBack || onBackUrl || onBackUrl === '') && (
          <ButtonRound
            onClick={() => (onBack ? onBack() : onBackUrl === '' ? backRoute() : replaceRoute(onBackUrl!))}
            color={BUTTON_ROUND_COLOR.lightGrey}
            size={BUTTON_ROUND_SIZE.large}
          >
            <ColoredIcon icon={ArrowLeft} size={24} color={ICON_COLOR.primary} />
            {/* {!!width && width > 425 && <p className={styles.label}>{backLabel ?? 'Back'}</p>} */}
          </ButtonRound>
        )}
        {sliderActionButton && (
          <ButtonRound
            onClick={toggleSlider}
            size={BUTTON_ROUND_SIZE.large}
            color={asPath === '/' ? BUTTON_ROUND_COLOR.primary : BUTTON_ROUND_COLOR.lightGrey}
          >
            <Slider width='24px' height='24px' />
          </ButtonRound>
        )}
        {onCorrect !== undefined && (
          <ButtonRound
            color={onCorrect ? BUTTON_ROUND_COLOR.primary : BUTTON_ROUND_COLOR.lightGrey}
            onClick={onCorrect ?? undefined}
            size={BUTTON_ROUND_SIZE.large}
          >
            <Correct width='24px' height='24px' />
            {/* {!!width && width > 425 && <p className={styles.label}>{correctLabel ?? 'Next'}</p>} */}
          </ButtonRound>
        )}
        {onForward !== undefined && (
          <ButtonRound
            color={onForward ? undefined : BUTTON_ROUND_COLOR.lightGrey}
            onClick={onForward ?? undefined}
            size={BUTTON_ROUND_SIZE.large}
          >
            <ArrowRight width='24px' height='24px' />
            {/* {!!width && width > 425 && <p className={styles.label}>{forwardLabel ?? 'Done'}</p>} */}
          </ButtonRound>
        )}
      </footer>
    );
  };

  return (
    <>
      <Header />

      <main className={cls(utilsStyles.main, utilsStyles.columnJustifyCenter, styles1.stepContainer)}>
        <div className={utilsStyles.spacer3} />
        {loading ? (
          <Loader />
        ) : !signedIn ? (
          <WalletCard name='Connect your Wallet' Img={WalletImg} onClick={navigateToAccount} />
        ) : (
          <div className='mainInterface'>
            {toggleSliderAction ? (
              <div>
                {/* I want to swap */}
                <div style={{ textAlign: "center" }} >
                  <p>I want to swap</p>
                  <div
                    className='container'
                    style={{
                      display: 'flex',
                      justifyContent: "space-between",
                      alignItems: "center"
                    }}
                  >
                    <div
                      className='amount'
                      style={{
                        backgroundColor: "#F0F0F0",
                        margin: "10px",
                        height: "46px",
                        width: "163px",
                        borderRadius: "23px",
                        display: 'flex',
                        justifyContent: "center",
                        alignItems: "center",
                      }}
                    >
                      token amount
                    </div>
                    <div
                      className='token'
                      style={{
                        backgroundColor: "#F0F0F0",
                        margin: "10px",
                        height: "46px",
                        width: "140px",
                        borderRadius: "23px",
                        display: 'flex',
                        justifyContent: "center",
                        alignItems: "center",
                      }}
                    >
                      <TokenSelector
                        value={selectedOption as CURRENCY_TOKEN}
                        onChange={setSelectedOption}
                        options={wallet.balances?.data ?? []}
                      />
                    </div>
                  </div>
                </div>

                {/* For */}
                <div style={{ textAlign: "center" }} >
                  <p>for</p>
                  <div
                    className='container'
                    style={{
                      display: 'flex',
                      justifyContent: "space-between",
                      alignItems: "center"
                    }}
                  >
                    <div
                      className='amount'
                      style={{
                        backgroundColor: "#F0F0F0",
                        margin: "10px",
                        height: "46px",
                        width: "163px",
                        borderRadius: "23px",
                        display: 'flex',
                        justifyContent: "center",
                        alignItems: "center",
                      }}
                    >
                      token amount
                    </div>
                    <div
                      className='token'
                      style={{
                        backgroundColor: "#F0F0F0",
                        margin: "10px",
                        height: "46px",
                        width: "140px",
                        borderRadius: "23px",
                        display: 'flex',
                        justifyContent: "center",
                        alignItems: "center",
                      }}
                    >
                      <TokenSelector
                        value={selectedOption as CURRENCY_TOKEN}
                        onChange={setSelectedOption}
                        options={wallet.balances?.data ?? []}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <p>Set max slappage to {slippage}%</p>
                <div style={{ display: "flex" }} >
                  <div
                    className='hug_1'
                    style={Hugstyles}
                  >
                    1%
                  </div>
                  <div
                    className='hug_2'
                    style={Hugstyles}
                  >
                    2%
                  </div>
                  <div
                    className='hug_3'
                    style={Hugstyles}
                  >
                    3%
                  </div>
                  <div
                    className='hug_4'
                    style={Hugstyles}
                  >
                    5%
                  </div>
                </div>
                <input
                  style={{ width: "268px" }}
                  type="range"
                  id="slippageSlider"
                  min={1}
                  max={5}
                  step={1}
                  value={slippage}
                  onChange={handleSlippageChange}
                />
              </div>
            )
            }
          </div>
        )}
        <div className={utilsStyles.spacer3} />
      </main>

      <Footer
        sliderActionButton={toggleSlider}
        onBackUrl='/'
        backLabel='Home'
        onCorrect={null}
      />
    </>
  );
};

export default SwapTokens;
