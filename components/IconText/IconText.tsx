import { HTMLAttributes, ReactNode } from 'react';
import cls from 'classnames';

import styles from './IconText.module.scss';

type IconTextProps = {
  Img: any;
  title: string;
  imgSize?: number;
  subTitle?: string;
  children?: ReactNode;
} & HTMLAttributes<HTMLDivElement>;

const IconText = ({ Img, title, subTitle, imgSize = 40, className, children, ...other }: IconTextProps) => {
  return (
    <div className={cls(styles.container, className)} {...other}>
      <Img width={imgSize} height={imgSize} />
      <br />
      <p>{title}</p>
      {<p>{subTitle}</p>}
      <br />
      <br />
      {children}
    </div>
  );
};

export default IconText;
