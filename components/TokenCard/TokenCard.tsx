import { HTMLAttributes } from 'react';

import styles from './TokenCard.module.scss';
import ImageWithFallback from '@components/ImageFallback/ImageFallback';
import { formatTokenAmount } from '@utils/currency';
import Card, { CARD_SIZE } from '@components/Card/Card';

// TODO: generate available vs staked vs undelegating colored border
// TODO: determine whether chain or ibc token
// TODO: find dolor values

const formatPercentage = (percentage: number) => {
  if (!percentage) return '0%';
  if (percentage < 1) return '1%';
  return `${Math.floor(percentage)}%`;
};

const generateBalanceGradient = (available: number = 0, staked: number = 0, undelegating: number = 0) => {
  const total = available + staked + undelegating;
  const availablePercentage = formatPercentage((available / total) * 100);
  const stakedPercentage = formatPercentage((staked / total) * 100);
  const undelegatingPercentage = formatPercentage((undelegating / total) * 100);
  const result = `linear-gradient(to right, var(--primary-color) ${availablePercentage}, var(--secondary-color) ${availablePercentage}, var(secondary-color) ${stakedPercentage}, var(--tertiary-color) ${stakedPercentage}) 5 !important`;
  return result;
};

type TokenCardProps = {
  denom: string;
  displayDenom: string;
  image?: string;
  available: number;
  onTokenClick: (denom: string) => void;
  type?: string;
  staked?: number;
  undelegating?: number;
  displayGradient?: boolean;
} & HTMLAttributes<HTMLDivElement>;

const TokenCard = ({
  denom,
  displayDenom,
  image = '/images/chain-logos/fallback.png',
  available,
  staked,
  type = '',
  undelegating,
  displayGradient = false,
  onTokenClick = (denom: string) => {},
}: TokenCardProps) => {
  if (!denom) return null;

  const handleTokenClick = () => onTokenClick(denom);

  return (
    <Card size={CARD_SIZE.xxsmall} className={styles.tokenCardWrapper} onClick={handleTokenClick}>
      <div
        className={styles.tokenCard}
        style={{
          borderImage: displayGradient ? generateBalanceGradient(available, staked, undelegating) : 'transparent',
        }}
      >
        <ImageWithFallback
          src={image}
          alt={denom}
          fallbackSrc='/images/chain-logos/fallback.png'
          width={38}
          height={38}
        />
        <div className={styles.tokenDenom}>
          <p className={styles.denom}>{displayDenom}</p>
          <p className={styles.denomType}>{type}</p>
        </div>
        <p>{formatTokenAmount(Number(available), 6, false)}</p>
      </div>
    </Card>
  );
};

export default TokenCard;
