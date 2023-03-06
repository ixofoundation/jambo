import { ButtonHTMLAttributes } from 'react';
import cls from 'classnames';

import styles from './Button.module.scss';

export enum BUTTON_COLOR {
  primary = 'withPrimaryColor',
  secondary = 'withSecondaryColor',
  tertiary = 'withTertiaryColor',
  success = 'withSuccessColor',
  disabled = 'withDisabledColor',
  grey = 'withGreyColor',
  lightGrey = 'withLightGreyColor',
}

export enum BUTTON_BG_COLOR {
  primary = 'withPrimaryBgColor',
  secondary = 'withSecondaryBgColor',
  tertiary = 'withTertiaryBgColor',
  success = 'withSuccessBgColor',
  disabled = 'withDisabledBgColor',
  grey = 'withGreyBgColor',
  lightGrey = 'withLightGreyBgColor',
}

export enum BUTTON_BORDER_COLOR {
  primary = 'withPrimaryBorderColor',
  secondary = 'withSecondaryBorderColor',
  tertiary = 'withTertiaryBorderColor',
  success = 'withSuccessBorderColor',
  disabled = 'withDisabledBorderColor',
  grey = 'withGreyBorderColor',
  lightGrey = 'withLightGreyBorderColor',
}

export enum BUTTON_SIZE {
  xlarge = 'xlarge',
  large = 'large',
  mediumLarge = 'mediumLarge',
  medium = 'medium',
  small = 'small',
  xsmall = 'xsmall',
  xxsmall = 'xxsmall',
}

type ButtonProps = {
  label: string;
  rounded?: boolean;
  size?: BUTTON_SIZE;
  color?: BUTTON_COLOR;
  bgColor?: BUTTON_BG_COLOR;
  borderColor?: BUTTON_BORDER_COLOR;
} & ButtonHTMLAttributes<HTMLButtonElement>;

const Button = ({ label, rounded, size, color, bgColor, borderColor, ...other }: ButtonProps) => {
  return (
    <button
      className={cls(
        styles.button,
        styles[size as typeof BUTTON_SIZE.medium],
        styles[color as typeof BUTTON_COLOR.primary],
        styles[bgColor as typeof BUTTON_BG_COLOR.primary],
        styles[borderColor as typeof BUTTON_BORDER_COLOR.primary],
        rounded ? styles.rounded : styles.squared,
      )}
      {...other}
    >
      {label}
    </button>
  );
};

export default Button;

type ViewOnExplorerButtonProps = {
  explorer: string;
};

export const ViewOnExplorerButton = ({ explorer }: ViewOnExplorerButtonProps) => (
  <Button
    label={`View on ${explorer}`}
    size={BUTTON_SIZE.mediumLarge}
    rounded
    bgColor={BUTTON_BG_COLOR.lightGrey}
    borderColor={BUTTON_BORDER_COLOR.lightGrey}
  />
);
