import { useContext, useEffect, useState } from 'react';
import cls from 'classnames';

import utilsStyles from '@styles/utils.module.scss';
import styles from './ChainSelector.module.scss';
import ButtonRound, { BUTTON_ROUND_COLOR, BUTTON_ROUND_SIZE } from '@components/ButtonRound/ButtonRound';
import ImageWithFallback from '@components/ImageFallback/ImageFallback';
import BottomSheet from '@components/BottomSheet/BottomSheet';
import Card, { CARD_SIZE } from '@components/Card/Card';
import Loader from '@components/Loader/Loader';
import { ChainContext } from '@contexts/chain';
import useModalState from '@hooks/modalState';

type ChainSelectorProps = {};

const ChainSelector = ({}: ChainSelectorProps) => {
  const [currentChainId, setCurrentChainId] = useState<string | undefined>();
  const [chainSelectVisible, showChainSelect, hideChainSelect] = useModalState(false);
  const { chains, chainInfo, chain, updateChainId } = useContext(ChainContext);

  useEffect(() => {
    if (chainInfo?.chainId && !chain.chainLoading && chainInfo?.chainId !== currentChainId)
      setCurrentChainId(chainInfo.chainId);
    else setCurrentChainId(undefined);
  }, [chainInfo, chain.chainLoading]);

  useEffect(() => {
    console.log({ currentChainId });
    if (currentChainId) {
      hideChainSelect();
    }
  }, [currentChainId]);

  const onChainClick = (chainId: string) => () => {
    if (chainInfo?.chainId !== chainId) {
      setCurrentChainId(undefined);
      updateChainId(chainId);
    }
  };

  return (
    <>
      <ButtonRound onClick={showChainSelect} size={BUTTON_ROUND_SIZE.xsmall} color={BUTTON_ROUND_COLOR.lightGrey}>
        {chainInfo?.chainSymbolImageUrl && (
          <ImageWithFallback
            fallbackSrc={'/images/chain-logos/fallback.png'}
            alt='Select a chain'
            src={chainInfo.chainSymbolImageUrl}
            height={42}
            width={42}
          />
        )}
      </ButtonRound>
      {chainSelectVisible && (
        <BottomSheet dismissable={!!currentChainId} onClose={hideChainSelect} title='Select a Chain'>
          {chains.map((chainOption) => (
            <Card
              className={cls(styles.chainWrapper)}
              key={chainOption.chainId}
              onClick={onChainClick(chainOption.chainId)}
              size={CARD_SIZE.small}
            >
              <div className={utilsStyles.rowAlignCenter}>
                {chainOption?.chainSymbolImageUrl && (
                  <ImageWithFallback
                    fallbackSrc={'/images/chain-logos/fallback.png'}
                    src={chainOption.chainSymbolImageUrl}
                    alt={chainOption.chainName}
                    height={32}
                    width={32}
                  />
                )}
                <p className={styles.chainName}>{chainOption.chainName}</p>
              </div>
              {chainInfo?.chainId === chainOption.chainId && chain.chainLoading && <Loader size={30} />}
            </Card>
          ))}
        </BottomSheet>
      )}
    </>
  );
};

export default ChainSelector;
