import { HTMLAttributes } from 'react';
import cls from 'classnames';

import styles from './Card.module.scss';

export enum CARD_SIZE {
  large = 'large',
  mediumLarge = 'mediumLarge',
  medium = '',
  small = 'small',
  xsmall = 'xsmall',
  xxsmall = 'xxsmall',
}

export enum CARD_COLOR {
  text = '',
  inverted = 'withInvertedColor',
  primary = 'withPrimaryColor',
  secondary = 'withSecondaryColor',
  tertiary = 'withTertiaryColor',
  success = 'withSuccessColor',
  disabled = 'withDisabledColor',
  grey = 'withGreyColor',
  lightGrey = 'withLightGreyColor',
}

export enum CARD_BG_COLOR {
  primary = 'withPrimaryBgColor',
  secondary = 'withSecondaryBgColor',
  tertiary = 'withTertiaryBgColor',
  success = 'withSuccessBgColor',
  disabled = 'withDisabledBgColor',
  grey = 'withGreyBgColor',
  background = 'withBackgroundBgColor',
  lightGrey = 'withLightGreyBgColor',
}

export type CardProps = {
  size?: CARD_SIZE;
  rounded?: boolean;
  color?: CARD_COLOR;
  bgColor?: CARD_BG_COLOR;
} & HTMLAttributes<HTMLDivElement>;

const Card = ({
  children,
  rounded = false,
  size = CARD_SIZE.medium,
  color = CARD_COLOR.text,
  bgColor = CARD_BG_COLOR.lightGrey,
  className,
  ...other
}: CardProps) => {
  return (
    <div
      className={cls(
        styles.card,
        styles[size as typeof CARD_SIZE.medium],
        styles[color as typeof CARD_COLOR.text],
        styles[bgColor as typeof CARD_BG_COLOR.lightGrey],
        rounded ? styles.roundedCard : styles.squaredCard,
        className,
      )}
      {...other}
    >
      {children}
    </div>
  );
};

export default Card;
