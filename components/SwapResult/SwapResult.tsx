import { useContext, useEffect, useState } from 'react';

import cls from 'classnames';

import Anchor from '@components/Anchor/Anchor';
import { ViewOnExplorerButton } from '@components/Button/Button';
import IconText from '@components/IconText/IconText';
import TokenCard from '@components/TokenCard/TokenCard';
import { ChainContext } from '@contexts/chain';
import Success from '@icons/success.svg';
import styles from '@styles/stepsPages.module.scss';
import utilsStyles from '@styles/utils.module.scss';
import {
  getCoinImageUrlFromCurrencyToken,
  getDenomFromCurrencyToken,
  getDisplayDenomFromCurrencyToken,
  getTokenTypeFromCurrencyToken,
} from '@utils/currency';
import { queryTrxResult } from '@utils/query';
import { getValueFromTrxEvents } from '@utils/transactions';
import { CURRENCY_TOKEN } from 'types/wallet';

import swapStyles from './SwapResult.module.scss';

type SwapResultProps = {
  inputToken: CURRENCY_TOKEN;
  outputToken: CURRENCY_TOKEN;
  trxHash: string;
};

export const SwapResult = ({ inputToken, outputToken, trxHash }: SwapResultProps) => {
  const [updatedInputAmount, setUpdatedInputAmount] = useState<number>(0);
  const [updatedOutputAmount, setUpdatedOutputAmount] = useState<number>(0);

  const { queryClient, chainInfo } = useContext(ChainContext);

  useEffect(() => {
    const setUpdatedAmounts = async () => {
      if (!queryClient) return;

      const trxRes = await queryTrxResult(queryClient, trxHash);
      if (!trxRes) return;

      const tokenAmountSold = getValueFromTrxEvents(trxRes.txResponse!, 'wasm', 'token_sold');
      const tokenAmountBought = getValueFromTrxEvents(trxRes.txResponse!, 'wasm', 'token_bought');

      setUpdatedInputAmount(Number(inputToken.amount) - Number(tokenAmountSold));
      setUpdatedOutputAmount(Number(outputToken.amount) + Number(tokenAmountBought));
    };

    setUpdatedAmounts();
  }, []);

  return (
    <main className={cls(utilsStyles.main, utilsStyles.columnJustifyCenter, styles.stepContainer)}>
      <IconText
        title='Your swap was successful!'
        Img={Success}
        imgSize={50}
        className={cls(swapStyles.swapResultWrapper)}
      >
        <div>
          <p className={cls(swapStyles.title)}>New token balances:</p>
          <TokenCard
            denom={getDenomFromCurrencyToken(inputToken)}
            image={getCoinImageUrlFromCurrencyToken(inputToken)}
            displayDenom={getDisplayDenomFromCurrencyToken(inputToken)}
            type={getTokenTypeFromCurrencyToken(inputToken, inputToken.chain)}
            available={updatedInputAmount}
            onTokenClick={() => {}}
            className={cls(swapStyles.card)}
          ></TokenCard>
          <TokenCard
            denom={getDenomFromCurrencyToken(outputToken)}
            image={getCoinImageUrlFromCurrencyToken(outputToken)}
            displayDenom={getDisplayDenomFromCurrencyToken(outputToken)}
            type={getTokenTypeFromCurrencyToken(outputToken, outputToken.chain)}
            available={updatedOutputAmount}
            onTokenClick={() => {}}
            className={cls(swapStyles.card)}
          ></TokenCard>
        </div>
        {chainInfo?.txExplorer && (
          <Anchor active openInNewTab href={`${chainInfo.txExplorer.txUrl.replace(/\${txHash}/i, trxHash)}`}>
            <ViewOnExplorerButton explorer={chainInfo.txExplorer.name} />
          </Anchor>
        )}
      </IconText>
    </main>
  );
};
