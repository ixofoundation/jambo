import { HTMLAttributes } from 'react';

import cls from 'classnames';

import Card, { CARD_SIZE } from '@components/Card/Card';
import ImageWithFallback from '@components/ImageFallback/ImageFallback';
import utilsStyles from '@styles/utils.module.scss';
import { formatTokenAmountByDenom } from '@utils/currency';
import { getCSSVariable } from '@utils/styles';

import styles from './TokenCard.module.scss';

// TODO: find dolor values

const formatPercentage = (percentage: number) => {
  if (!percentage) return '0%';
  if (percentage < 1) return '1%';
  return `${Math.floor(percentage)}%`;
};

const generateBalanceGradient = (available: number = 0, staked: number = 0, undelegating: number = 0) => {
  // colors
  const primaryColor = getCSSVariable('--primary-color');
  const secondaryColor = getCSSVariable('--secondary-color');
  const tertiaryColor = getCSSVariable('--tertiary-color');

  // percentages
  const total = available + staked + undelegating;
  const availablePercentage = formatPercentage((available / total) * 100);
  const stakedPercentage = formatPercentage((staked / total) * 100);
  const undelegatingPercentage = formatPercentage((undelegating / total) * 100);

  // gradient
  const result = `linear-gradient(to right, ${primaryColor} ${availablePercentage}, ${secondaryColor} ${availablePercentage}, ${secondaryColor} ${stakedPercentage}, ${tertiaryColor} ${stakedPercentage})`;

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
  className,
}: TokenCardProps) => {
  if (!denom) return null;

  const handleTokenClick = () => onTokenClick(denom);

  return (
    <Card
      size={CARD_SIZE.medium}
      onClick={handleTokenClick}
      className={cls(
        styles.tokenCardWrapper,
        utilsStyles.rowAlignCenter,
        displayGradient && styles.gradientTokenCardWrapper,
        className,
      )}
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
      <p>{formatTokenAmountByDenom(denom, available)}</p>
      {displayGradient && (
        <div
          className={styles.gradient}
          style={{ background: generateBalanceGradient(available, staked, undelegating) }}
        />
      )}
    </Card>
  );
};

export default TokenCard;
