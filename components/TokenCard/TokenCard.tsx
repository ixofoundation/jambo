import { FC, HTMLAttributes } from 'react';
import cls from 'classnames';

import styles from './TokenCard.module.scss';
import utilsStyles from '@styles/utils.module.scss';
import ImageWithFallback from '@components/ImageFallback/ImageFallback';
import Card, { CARD_SIZE } from '@components/Card/Card';
import {
  calculateTokenAmount,
  getAmountFromCurrencyToken,
  getCoinImageUrlFromCurrencyToken,
  getDecimalsFromCurrencyToken,
  getDenomFromCurrencyToken,
  getDisplayDenomFromCurrencyToken,
  getTokenTypeFromCurrencyToken,
} from '@utils/currency';
import { getCSSVariable } from '@utils/styles';
import { CURRENCY_TOKEN } from 'types/wallet';

// TODO: find dolor values

type TokenCardProps = {
  token?: CURRENCY_TOKEN;
  onTokenClick: (denom: string) => void;
  className?: string;
} & HTMLAttributes<HTMLDivElement>;

const TokenCard: FC<TokenCardProps> = ({ token, children, className, onTokenClick = (denom: string) => {} }) => {
  if (!getDenomFromCurrencyToken(token)) return null;

  const handleTokenClick = () => onTokenClick(getDenomFromCurrencyToken(token));

  return (
    <Card
      size={CARD_SIZE.medium}
      onClick={handleTokenClick}
      className={cls(styles.tokenCardWrapper, utilsStyles.rowAlignCenter, className)}
    >
      <ImageWithFallback
        src={getCoinImageUrlFromCurrencyToken(token)}
        alt={getDenomFromCurrencyToken(token)}
        fallbackSrc='/images/chain-logos/fallback.png'
        width={38}
        height={38}
      />
      <div className={styles.tokenDenom}>
        <p className={styles.denom}>{getDisplayDenomFromCurrencyToken(token)}</p>
        <p className={styles.denomType}>{getTokenTypeFromCurrencyToken(token)}</p>
      </div>
      <p>{calculateTokenAmount(getAmountFromCurrencyToken(token), getDecimalsFromCurrencyToken(token), false)}</p>
      {children}
    </Card>
  );
};

export default TokenCard;

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

type GradientTokenCardProps = {
  available: number;
  staked?: number;
  undelegating?: number;
} & TokenCardProps;

export const GradientTokenCard: FC<GradientTokenCardProps> = ({ available, staked, undelegating, ...other }) => {
  return (
    <TokenCard className={cls(styles.gradientTokenCardWrapper)} {...other}>
      <div
        className={styles.gradient}
        style={{ background: generateBalanceGradient(available, staked, undelegating) }}
      />
    </TokenCard>
  );
};
