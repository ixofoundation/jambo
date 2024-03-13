import { useContext, useEffect, useState } from 'react';

import cls from 'classnames';

import Input, { InputWithMax } from '@components/Input/Input';
import Loader from '@components/Loader/Loader';
import TokenSelector from '@components/TokenSelector/TokenSelector';
import { ChainContext } from '@contexts/chain';
import { WalletContext } from '@contexts/wallet';
import styles from '@styles/stepsPages.module.scss';
import utilsStyles from '@styles/utils.module.scss';
import { formattedAmountToNumber, formatTokenAmountByDenom } from '@utils/currency';
import { queryOutputAmountByInputAmount } from '@utils/query';
import {
  getInputTokenAmount,
  getSwapContractAddress,
  getSwapContractsOutputsForInputDenoms,
  getSwapTokens,
  getTokenSelectByDenom,
  isCw1155Token,
} from '@utils/swap';
import { CURRENCY_TOKEN } from 'types/wallet';

import swapStyles from './Swap.module.scss';

type SwapProps = {
  inputToken: CURRENCY_TOKEN | undefined;
  outputToken: CURRENCY_TOKEN | undefined;
  inputAmount: string;
  outputAmount: string;
  setInputToken: (token: CURRENCY_TOKEN | undefined) => void;
  setOutputToken: (token: CURRENCY_TOKEN | undefined) => void;
  setInputAmount: (token: string) => void;
  setOutputAmount: (token: string) => void;
};

export const Swap = (props: SwapProps) => {
  const {
    inputToken,
    outputToken,
    inputAmount,
    outputAmount,
    setInputToken,
    setOutputToken,
    setInputAmount,
    setOutputAmount,
  } = props;

  const [amountLoading, setAmountLoading] = useState(false);

  const { wallet } = useContext(WalletContext);
  const { queryClient } = useContext(ChainContext);

  useEffect(() => {
    const getOutputAmount = async () => {
      if (queryClient && inputToken && outputToken && inputAmount && inputToken !== outputToken) {
        setAmountLoading(true);

        const inputTokenSelect = getTokenSelectByDenom(inputToken.denom);
        const inputTokenAmount = getInputTokenAmount(inputToken, inputTokenSelect, inputAmount);
        const contractAddress = getSwapContractAddress(inputToken.denom, outputToken.denom);

        const outputAmount = await queryOutputAmountByInputAmount(
          queryClient,
          inputTokenSelect,
          inputTokenAmount,
          contractAddress,
        );

        setOutputAmount(formatTokenAmountByDenom(outputToken.denom, Number(outputAmount)));
        setAmountLoading(false);
      }
    };

    getOutputAmount();
  }, [inputAmount]);

  const getInputTokenOptions = (): CURRENCY_TOKEN[] => {
    const walletBalancesOptions = wallet.balances?.data ?? [];
    const walletTokensOptions = wallet.tokenBalances?.data ?? [];

    return [...getSwapTokens(walletBalancesOptions), ...walletTokensOptions];
  };
  const getOutputTokenOptions = (): CURRENCY_TOKEN[] => {
    const test = getSwapContractsOutputsForInputDenoms(inputToken?.denom ?? '');
    return test;
  };
  const handleInputTokenChange = (token: CURRENCY_TOKEN) => {
    if (token.denom == outputToken?.denom) {
      setOutputToken(inputToken);
      setOutputAmount(inputAmount);
      setInputAmount(outputAmount);
    }

    setInputToken(token);
  };
  const handleOutputTokenChange = (token: CURRENCY_TOKEN) => {
    if (token.denom == inputToken?.denom) {
      setInputToken(outputToken);
      setInputAmount(outputAmount);
      setOutputAmount(inputAmount);
    }

    setOutputToken(token);
  };

  return (
    <form className={styles.stepsForm} autoComplete='none'>
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
              decimalAmount={inputToken ? isCw1155Token(inputToken.denom) : true}
            />
          </div>
          <div className={cls(utilsStyles.paddingToken, utilsStyles.widthToken)}>
            <TokenSelector
              value={inputToken}
              onChange={handleInputTokenChange}
              options={getInputTokenOptions()}
              displaySwapOptions
            />
          </div>
        </div>
      </div>
      <div className={utilsStyles.columnAlignCenter}>
        <p className={cls(styles.label, styles.titleWithSubtext)}>for</p>
        <div className={utilsStyles.rowAlignCenter}>
          <div>
            <Input
              name='walletAddress'
              type='number'
              required
              value={outputAmount && formattedAmountToNumber(outputAmount)}
              disabled={amountLoading}
              className={cls(styles.stepInput)}
              onChange={(e) => setOutputAmount(e.target.value)}
            />
          </div>
          <div className={cls(utilsStyles.paddingTop, utilsStyles.widthToken)}>
            <TokenSelector
              value={outputToken}
              onChange={handleOutputTokenChange}
              options={getOutputTokenOptions()}
              displaySwapOptions
            />
          </div>
        </div>
      </div>
      {amountLoading ? (
        <div className={cls(swapStyles.amountLoading)}>
          <Loader size={20} /> Fetching output amount...
        </div>
      ) : null}
    </form>
  );
};
