import { ButtonHTMLAttributes } from 'react';
import cls from 'classnames';

import styles from './ButtonRound.module.scss';
import Correct from '@icons/correct.svg';

export enum BUTTON_ROUND_COLOR {
  primary = 'withPrimaryBgColor',
  secondary = 'withSecondaryBgColor',
  tertiary = 'withTertiaryBgColor',
  success = 'withSuccessBgColor',
  warning = 'withWarningBgColor',
  error = 'withErrorBgColor',
  disabled = 'withDisabledBgColor',
  grey = 'withGreyBgColor',
  lightGrey = 'withLightGreyBgColor',
  white = 'withWhiteBgColor',
}

export enum BUTTON_ROUND_SIZE {
  lxarge = 'xlarge',
  large = 'large',
  mediumLarge = 'mediumLarge',
  medium = '',
  small = 'small',
  xsmall = 'xsmall',
  xxsmall = 'xxsmall',
}

type ButtonRoundProps = {
  label?: string;
  color?: BUTTON_ROUND_COLOR;
  size?: BUTTON_ROUND_SIZE;
  successMark?: boolean;
} & ButtonHTMLAttributes<HTMLButtonElement>;

const ButtonRound = ({
  label,
  children,
  color = BUTTON_ROUND_COLOR.primary,
  size = BUTTON_ROUND_SIZE.medium,
  className,
  successMark = false,
  ...other
}: ButtonRoundProps) => {
  return (
    <div className={cls(styles.buttonContainer, className)}>
      <button
        className={cls(
          styles.button,
          styles[color as typeof BUTTON_ROUND_COLOR.primary],
          styles[size as typeof BUTTON_ROUND_SIZE.medium],
        )}
        {...other}
      >
        {children}
        {successMark && (
          <div className={styles.successMark}>
            <Correct />
          </div>
        )}
      </button>
      {label && <p className={styles.label}>{label}</p>}
    </div>
  );
};

export default ButtonRound;
