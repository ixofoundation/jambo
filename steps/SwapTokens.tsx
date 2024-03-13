import { FC, useContext, useState } from 'react';

import cls from 'classnames';

import WalletCard from '@components/CardWallet/CardWallet';
import Footer from '@components/Footer/Footer';
import Header from '@components/Header/Header';
import Loader from '@components/Loader/Loader';
import Slider from '@components/Slider/Slider';
import { Swap } from '@components/Swap/Swap';
import { SwapResult } from '@components/SwapResult/SwapResult';
import { ChainContext } from '@contexts/chain';
import { WalletContext } from '@contexts/wallet';
import WalletImg from '@icons/wallet.svg';
import styles from '@styles/stepsPages.module.scss';
import utilsStyles from '@styles/utils.module.scss';
import { validateAmountAgainstBalance } from '@utils/currency';
import { queryApprovalVerification } from '@utils/query';
import { pushNewRoute } from '@utils/router';
import {
  getInputTokenAmount,
  getOutputTokenAmount,
  getSwapContractAddress,
  getSwapFunds,
  getTokenInfoByDenom,
  getTokenSelectByDenom,
  isCw1155Token,
} from '@utils/swap';
import { defaultTrxFeeOption, generateApproveTrx, generateSwapTrx, getValueFromTrxEvents } from '@utils/transactions';
import { broadCastMessages } from '@utils/wallets';
import { KEPLR_CHAIN_INFO_TYPE } from 'types/chain';
import { StepConfigType, StepDataType, STEPS } from 'types/steps';
import { TokenType } from 'types/swap';
import { CURRENCY_TOKEN } from 'types/wallet';

type SwapTokensProps = {
  onSuccess: (data: StepDataType<STEPS.swap_tokens>) => void;
  onBack?: () => void;
  data?: StepDataType<STEPS.select_token_and_amount>;
  config?: StepConfigType<STEPS.swap_tokens>;
  header?: string;
  loading?: boolean;
  signedIn?: boolean;
};

const SwapTokens: FC<SwapTokensProps> = ({ onBack, data, header, loading = false, signedIn = true }) => {
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
  const [trxLoading, setTrxLoading] = useState(false);
  const [successHash, setSuccessHash] = useState<string | undefined>();

  const { wallet, fetchBalances, fetchTokenBalances } = useContext(WalletContext);
  const { chainInfo, queryClient } = useContext(ChainContext);

  const navigateToAccount = () => pushNewRoute('/account');
  const toggleSlider = () => {
    setToggleSliderAction(!toggleSliderAction);
  };

  const formIsValid = () => {
    const inputValid =
      !!inputToken &&
      Number.parseFloat(inputAmount) > 0 &&
      validateAmountAgainstBalance(
        Number.parseFloat(inputAmount),
        Number(inputToken.amount),
        !isCw1155Token(inputToken.denom),
      );
    const outputValid = !!outputToken && Number.parseFloat(outputAmount) > 0;

    return inputToken !== outputToken && inputValid && outputValid;
  };

  const signTX = async (): Promise<void> => {
    if (!inputToken || !outputToken || !queryClient) return;
    setTrxLoading(true);

    const inputTokenSelect = getTokenSelectByDenom(inputToken.denom);
    const inputTokenAmount = getInputTokenAmount(inputToken, inputTokenSelect, inputAmount);

    const outputTokenSelect = getTokenSelectByDenom(outputToken.denom);
    const outputTokenAmount = getOutputTokenAmount(outputTokenSelect, outputAmount, slippage);

    const funds = getSwapFunds(inputToken.denom, inputAmount);
    const swapContractAddress = getSwapContractAddress(inputToken.denom, outputToken.denom);

    const trxs = [];
    const tokenInfo = getTokenInfoByDenom(inputToken.denom);
    if (tokenInfo.type == TokenType.Cw1155) {
      const isSwapContractApproved = await queryApprovalVerification(
        queryClient,
        wallet.user?.address!,
        swapContractAddress,
        tokenInfo.address!,
      );
      console.log(isSwapContractApproved);

      if (!isSwapContractApproved)
        trxs.push(
          generateApproveTrx({
            contract: tokenInfo.address!,
            operator: swapContractAddress,
            sender: wallet.user?.address!,
          }),
        );
    }

    trxs.push(
      generateSwapTrx({
        contract: swapContractAddress,
        inputTokenSelect,
        inputTokenAmount,
        outputTokenAmount,
        sender: wallet.user?.address!,
        funds,
      }),
    );
    const hash = await broadCastMessages(
      wallet,
      trxs,
      undefined,
      defaultTrxFeeOption,
      '',
      chainInfo as KEPLR_CHAIN_INFO_TYPE,
    );

    if (hash) {
      setSuccessHash(hash);
      fetchBalances();
      fetchTokenBalances();
    }
    setTrxLoading(false);
  };

  if (successHash && inputToken && outputToken)
    return (
      <>
        <Header header={header} />

        <SwapResult inputToken={inputToken} outputToken={outputToken} trxHash={successHash} />

        <Footer showAccountButton={!!successHash} showActionsButton={!!successHash} />
      </>
    );

  return (
    <>
      <Header />

      <main className={cls(utilsStyles.main, utilsStyles.columnJustifyCenter, styles.stepContainer)}>
        <div className={utilsStyles.spacer3} />
        {loading || trxLoading ? (
          <Loader />
        ) : !signedIn ? (
          <WalletCard name='Connect your Wallet' Img={WalletImg} onClick={navigateToAccount} />
        ) : (
          <div className='mainInterface'>
            {toggleSliderAction ? (
              <div>
                <Slider value={slippage} onChange={setSlippage} />
              </div>
            ) : (
              <Swap
                inputToken={inputToken}
                inputAmount={inputAmount}
                outputAmount={outputAmount}
                outputToken={outputToken}
                setInputAmount={setInputAmount}
                setInputToken={setInputToken}
                setOutputAmount={setOutputAmount}
                setOutputToken={setOutputToken}
              ></Swap>
            )}
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
