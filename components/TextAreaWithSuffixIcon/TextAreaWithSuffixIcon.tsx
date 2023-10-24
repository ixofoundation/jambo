import { FC, TextareaHTMLAttributes } from 'react';
import cls from 'classnames';

import styles from './TextAreaWithSuffixIcon.module.scss';
import ColoredIcon, { ICON_COLOR } from '@components/ColoredIcon/ColoredIcon';
import Card, { CARD_BG_COLOR, CARD_SIZE } from '@components/Card/Card';

type TextAreaWithSuffixIconProps = {
  icon: React.ElementType;
  label?: string;
  bgColor?: CARD_BG_COLOR;
  iconColor?: ICON_COLOR;
  onIconClick?: () => void;
} & TextareaHTMLAttributes<HTMLTextAreaElement>;

const TextAreaWithSuffixIcon: FC<TextAreaWithSuffixIconProps> = ({
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
      <Card className={styles.inputContainer} bgColor={bgColor} size={CARD_SIZE.xxsmall}>
        <textarea className={styles.input} {...other} />
        <ColoredIcon icon={icon} size={22} color={iconColor} onClick={onIconClick} className={styles.inputIcon} />
      </Card>
    </div>
  );
};

export default TextAreaWithSuffixIcon;
