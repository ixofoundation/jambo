import { HTMLAttributes, ReactNode, useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import cls from 'classnames';

import styles from './BottomSheet.module.scss';
import { CARD_BG_COLOR } from '@components/Card/Card';

type BottomSheetProps = {
  title?: string;
  children: ReactNode;
  onClose: () => void;
  dismissable?: boolean;
  bgColor?: CARD_BG_COLOR;
} & HTMLAttributes<HTMLDivElement>;

const BottomSheet = ({
  dismissable = false,
  onClose,
  title,
  bgColor = CARD_BG_COLOR.lightGrey,
  className,
  children,
  ...other
}: BottomSheetProps) => {
  const [isBrowser, setIsBrowser] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsBrowser(true);

    window.addEventListener('click', backDropHandler, true);
    return () => window.removeEventListener('click', backDropHandler, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (dismissable) {
      window.addEventListener('click', backDropHandler, true);
      return () => window.removeEventListener('click', backDropHandler, true);
    } else {
      () => window.removeEventListener('click', backDropHandler, true);
    }
  }, [dismissable]);

  const backDropHandler = (e: MouseEvent) => {
    if (modalRef?.current != null && !modalRef?.current?.contains(e.target as Node)) {
      onClose();
    }
  };

  const sheetContent = (
    <div className={styles.backdrop}>
      <div className={cls(styles.sheet, className, styles[bgColor as CARD_BG_COLOR])} ref={modalRef} {...other}>
        {!!title && <h3 className={styles.sheetTitle}>{title}</h3>}
        {children}
      </div>
    </div>
  );

  if (isBrowser) {
    return ReactDOM.createPortal(sheetContent, document.getElementById('modal-root') as HTMLElement);
  } else {
    return null;
  }
};

export default BottomSheet;
