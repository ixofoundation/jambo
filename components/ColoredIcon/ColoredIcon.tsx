import { HTMLAttributes } from 'react';
import cls from 'classnames';

import styles from './ColoredIcon.module.scss';

export enum ICON_COLOR {
  white = '',
  primary = 'withPrimaryColor',
  secondary = 'withSecondaryColor',
  tertiary = 'withTertiaryColor',
  success = 'withSuccessColor',
  disabled = 'withDisabledColor',
  grey = 'withGreyColor',
  iconGrey = 'withIconGreyColor',
  lightGrey = 'withLightGreyColor',
}

type ColoredIconProps = {
  icon: React.ElementType;
  color: ICON_COLOR;
  size?: number;
} & HTMLAttributes<SVGAElement>;

export const ColoredIcon = ({
  icon: Icon,
  color = ICON_COLOR.white,
  size = 24,
  className,
  ...other
}: ColoredIconProps) => {
  return (
    <div
      className={cls(styles.iconWrapper, styles[color as typeof ICON_COLOR.white], className)}
      style={{ width: size, height: size }}
    >
      <Icon width={size} height={size} {...other} />
    </div>
  );
};

export default ColoredIcon;
