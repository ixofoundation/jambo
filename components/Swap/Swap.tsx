import { useContext } from 'react';

import cls from 'classnames';

import Input, { InputWithMax } from '@components/Input/Input';
import TokenSelector from '@components/TokenSelector/TokenSelector';
import { WalletContext } from '@contexts/wallet';
import styles from '@styles/stepsPages.module.scss';
import utilsStyles from '@styles/utils.module.scss';
import { getSwapTokens } from '@utils/swap';
import { CURRENCY_TOKEN } from 'types/wallet';

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
  const { wallet } = useContext(WalletContext);

  const getTokenOptions = (): CURRENCY_TOKEN[] => {
    const walletBalancesOptions = wallet.balances?.data ?? [];
    const walletTokensOptions = wallet.tokenBalances?.data ?? [];

    return [...getSwapTokens(walletBalancesOptions), ...walletTokensOptions];
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
              isCoin={false}
            />
          </div>
          <div className={cls(utilsStyles.paddingToken, utilsStyles.widthToken)}>
            <TokenSelector
              value={inputToken}
              onChange={handleInputTokenChange}
              options={getTokenOptions()}
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
              value={outputAmount}
              className={cls(styles.stepInput)}
              onChange={(e) => setOutputAmount(e.target.value)}
            />
          </div>
          <div className={cls(utilsStyles.paddingTop, utilsStyles.widthToken)}>
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
  );
};
