import { FC, InputHTMLAttributes } from 'react';
import cls from 'classnames';

import styles from './InputWithSuffixIcon.module.scss';
import ColoredIcon, { ICON_COLOR } from '@components/ColoredIcon/ColoredIcon';
import Card, { CARD_BG_COLOR, CARD_SIZE } from '@components/Card/Card';

type InputWithSuffixIconProps = {
  icon: React.ElementType;
  label?: string;
  bgColor?: CARD_BG_COLOR;
  iconColor?: ICON_COLOR;
  onIconClick?: () => void;
} & InputHTMLAttributes<HTMLInputElement>;

const InputWithSuffixIcon: FC<InputWithSuffixIconProps> = ({
  label,
  className,
  icon,
  onIconClick = () => {},
  bgColor = CARD_BG_COLOR.lightGrey,
  iconColor = ICON_COLOR.primary,
  ...other
}) => {
  return (
    <div className={cls(styles.label, className)}>
      {label}
      <Card className={styles.inputContainer} rounded bgColor={bgColor} size={CARD_SIZE.xxsmall}>
        <input className={styles.input} {...other} />
        <ColoredIcon icon={icon} size={22} color={iconColor} onClick={onIconClick} className={styles.inputIcon} />
      </Card>
    </div>
  );
};

export default InputWithSuffixIcon;
