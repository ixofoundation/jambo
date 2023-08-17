import { ChangeEvent, FC, useContext, useState } from 'react';

import cls from 'classnames';

import Anchor from '@components/Anchor/Anchor';
import { ViewOnExplorerButton } from '@components/Button/Button';
import WalletCard from '@components/CardWallet/CardWallet';
import Footer from '@components/Footer/Footer';
import Header from '@components/Header/Header';
import IconText from '@components/IconText/IconText';
import Input, { InputWithMax } from '@components/Input/Input';
import Loader from '@components/Loader/Loader';
import Slider from '@components/Slider/Slider';
import TokenCard from '@components/TokenCard/TokenCard';
import TokenSelector from '@components/TokenSelector/TokenSelector';
import { pools, TokenAmount, tokens, TokenSelect, TokenType } from '@constants/pools';
import { ChainContext } from '@contexts/chain';
import { WalletContext } from '@contexts/wallet';
import Success from '@icons/success.svg';
import WalletImg from '@icons/wallet.svg';
import styles from '@styles/stepsPages.module.scss';
import utilsStyles from '@styles/utils.module.scss';
import {
  getCoinImageUrlFromCurrencyToken,
  getDenomFromCurrencyToken,
  getDisplayDenomFromCurrencyToken,
  getTokenTypeFromCurrencyToken,
  validateAmountAgainstBalance,
} from '@utils/currency';
import { getMicroAmount } from '@utils/encoding';
import { queryTrxResult } from '@utils/query';
import { pushNewRoute } from '@utils/router';
import { defaultTrxFeeOption, generateSwapTrx, getValueFromTrxEvents } from '@utils/transactions';
import { broadCastMessages } from '@utils/wallets';
import { KEPLR_CHAIN_INFO_TYPE } from 'types/chain';
import { StepConfigType, StepDataType, STEPS } from 'types/steps';
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
  const [updatedInputAmount, setUpdatedInputAmount] = useState<number | undefined>();
  const [updatedOutputAmount, setUpdatedOutputAmount] = useState<number | undefined>();
  const [inputToken, setInputToken] = useState<CURRENCY_TOKEN | undefined>();
  const [outputToken, setOutputToken] = useState<CURRENCY_TOKEN | undefined>();
  const [toggleSliderAction, setToggleSliderAction] = useState(false);
  const [slippage, setSlippage] = useState(1);
  const [trxLoading, setTrxLoading] = useState(false);
  const [successHash, setSuccessHash] = useState<string | undefined>();

  const { wallet, fetchAssets } = useContext(WalletContext);
  const { queryClient, chainInfo } = useContext(ChainContext);

  const navigateToAccount = () => pushNewRoute('/account');
  const toggleSlider = () => {
    setToggleSliderAction(!toggleSliderAction);
  };
  const getTokenOptions = (): CURRENCY_TOKEN[] => {
    const walletBalancesOptions = wallet.balances?.data ?? [];
    const walletTokensOptions = wallet.tokenBalances?.data ?? [];

    return [...walletBalancesOptions.filter((balance) => tokens.has(balance.denom)), ...walletTokensOptions];
  };

  const handleInputTokenChange = (token: CURRENCY_TOKEN) => {
    if (token == outputToken) {
      setOutputToken(inputToken);
      setOutputAmount(inputAmount);
      setInputAmount(outputAmount);
    }

    setInputToken(token);
  };
  const handleOutputTokenChange = (token: CURRENCY_TOKEN) => {
    if (token == inputToken) {
      setInputToken(outputToken);
      setInputAmount(outputAmount);
      setOutputAmount(inputAmount);
    }

    setOutputToken(token);
  };
  const formIsValid = () => {
    const inputValid =
      !!inputToken &&
      Number.parseFloat(inputAmount) > 0 &&
      validateAmountAgainstBalance(Number.parseFloat(inputAmount), Number(inputToken.amount), false);
    const outputValid = !!outputToken && Number.parseFloat(outputAmount) > 0;

    return inputToken !== outputToken && inputValid && outputValid;
  };

  const signTX = async (): Promise<void> => {
    if (!inputToken || !outputToken) return;
    setTrxLoading(true);

    const inputTokenType = tokens.get(inputToken.denom)?.type;
    const inputTokenSelect = inputTokenType === TokenType.Cw1155 ? TokenSelect.Token1155 : TokenSelect.Token2;
    const contractAddress =
      inputTokenSelect === TokenSelect.Token1155
        ? pools.get({ token1155: inputToken.denom, token2: outputToken?.denom })
        : pools.get({ token1155: outputToken.denom, token2: inputToken?.denom });

    let inputTokenAmount: TokenAmount;
    if (inputTokenSelect === TokenSelect.Token1155 && inputToken?.batches) {
      let totalInputAmountRest = Number(inputAmount);
      let inputTokenBatches = new Map<string, string>();
      for (const [tokenId, amount] of inputToken?.batches) {
        const tokenAmount = Number(amount);

        if (tokenAmount) {
          if (tokenAmount > totalInputAmountRest) {
            inputTokenBatches.set(tokenId, totalInputAmountRest.toString());
            totalInputAmountRest = 0;
          } else {
            inputTokenBatches.set(tokenId, amount);
            totalInputAmountRest -= tokenAmount;
          }
        }

        if (!totalInputAmountRest) break;
      }

      inputTokenAmount = { multiple: Object.fromEntries(inputTokenBatches) };
    } else {
      inputTokenAmount = { single: inputAmount };
    }

    const outputAmountNumber = Number.parseFloat(outputAmount);
    const outPutAmountWithSlippage = outputAmountNumber - outputAmountNumber * (slippage / 100);
    const outputTokenAmount = { single: outPutAmountWithSlippage.toFixed() };

    const funds = new Map<string, string>();
    if (inputTokenType === TokenType.Native) {
      funds.set(inputToken.denom, getMicroAmount(inputAmount));
    }

    const trx = generateSwapTrx({
      contractAddress,
      inputTokenSelect,
      inputTokenAmount,
      outputTokenAmount,
      senderAddress: wallet.user?.address!,
      funds,
    });
    const hash = await broadCastMessages(
      wallet,
      [trx],
      undefined,
      defaultTrxFeeOption,
      '',
      chainInfo as KEPLR_CHAIN_INFO_TYPE,
    );

    if (hash && queryClient) {
      const trxRes = await queryTrxResult(queryClient, hash);
      const tokenAmountSold = getValueFromTrxEvents(trxRes.txResponse!, 'wasm', 'token_sold');
      const tokenAmountBought = getValueFromTrxEvents(trxRes.txResponse!, 'wasm', 'token_bought');

      setUpdatedInputAmount(Number(inputToken.amount) - Number(tokenAmountSold));
      setUpdatedOutputAmount(Number(outputToken.amount) + Number(tokenAmountBought));

      setSuccessHash(hash);
    }

    setTrxLoading(false);
  };

  if (successHash && inputToken && outputToken && updatedInputAmount && updatedOutputAmount)
    return (
      <>
        <Header header={header} />

        <main className={cls(utilsStyles.main, utilsStyles.columnJustifyCenter, styles.stepContainer)}>
          <IconText title='Your swap was successful!' Img={Success} imgSize={50} className={cls(styles.result)}>
            <div>
              <p className={cls(styles.title)}>New token balances:</p>
              <TokenCard
                denom={getDenomFromCurrencyToken(inputToken)}
                image={getCoinImageUrlFromCurrencyToken(inputToken)}
                displayDenom={getDisplayDenomFromCurrencyToken(inputToken)}
                type={getTokenTypeFromCurrencyToken(inputToken, inputToken.chain)}
                available={updatedInputAmount}
                onTokenClick={() => {}}
                className={cls(styles.card)}
              ></TokenCard>
              <TokenCard
                denom={getDenomFromCurrencyToken(outputToken)}
                image={getCoinImageUrlFromCurrencyToken(outputToken)}
                displayDenom={getDisplayDenomFromCurrencyToken(outputToken)}
                type={getTokenTypeFromCurrencyToken(outputToken, outputToken.chain)}
                available={updatedOutputAmount}
                onTokenClick={() => {}}
                className={cls(styles.card)}
              ></TokenCard>
            </div>
            {chainInfo?.txExplorer && (
              <Anchor active openInNewTab href={`${chainInfo.txExplorer.txUrl.replace(/\${txHash}/i, successHash)}`}>
                <ViewOnExplorerButton explorer={chainInfo.txExplorer.name} />
              </Anchor>
            )}
          </IconText>
        </main>

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
              <form className={styles.stepsForm} autoComplete='none'>
                {/* I want to swap */}
                <div className={utilsStyles.columnAlignCenter}>
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
                        onChange={(e) => setInputAmount(e.target.value)}
                      />
                    </div>
                    <div className={utilsStyles.paddingToken}>
                      <TokenSelector
                        value={inputToken}
                        onChange={handleInputTokenChange}
                        options={getTokenOptions()}
                        displaySwapOptions
                      />
                    </div>
                  </div>
                </div>
                {/* For */}
                <div className={utilsStyles.columnAlignCenter}>
                  <p className={cls(styles.label, styles.titleWithSubtext)}>for</p>
                  <div className={utilsStyles.rowAlignCenter}>
                    <div>
                      <Input
                        name='walletAddress'
                        type='number'
                        required
                        value={outputAmount}
                        className={cls(styles.stepInput)}
                        onChange={(e) => setOutputAmount(e.target.value)}
                      />
                    </div>
                    <div className={utilsStyles.paddingTop}>
                      <TokenSelector
                        value={outputToken}
                        onChange={handleOutputTokenChange}
                        options={getTokenOptions()}
                        displaySwapOptions
                      />
                    </div>
                  </div>
                </div>
              </form>
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
