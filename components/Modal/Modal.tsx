import { HTMLAttributes, ReactNode, useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import cls from 'classnames';

import styles from './Modal.module.scss';
import Cross from '@icons/cross.svg';

type ModalProps = {
  onClose: () => void;
  title?: string;
  children: ReactNode;
} & HTMLAttributes<HTMLDivElement>;

function Modal({ onClose, children, title, className, ...other }: ModalProps) {
  const [isBrowser, setIsBrowser] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsBrowser(true);

    window.addEventListener('click', backDropHandler, true);
    return () => window.removeEventListener('click', backDropHandler, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const backDropHandler = (e: MouseEvent) => {
    if (modalRef?.current != null && !modalRef?.current?.contains(e.target as Node)) {
      onClose();
    }
  };

  const handleCloseClick = (e: React.MouseEvent<HTMLElement>) => {
    e.preventDefault();
    onClose();
  };

  const modalContent = (
    <div className={styles.modalOverlay}>
      <div className={cls(styles.modal, className)} ref={modalRef} {...other}>
        <div className={styles.modalHeader}>
          {title && <h1 className={styles.modalTitle}>{title}</h1>}
          <a href='#' onClick={handleCloseClick} className={styles.closeCross}>
            <Cross color='black' />
          </a>
        </div>
        <div>{children}</div>
      </div>
    </div>
  );

  if (isBrowser) {
    return ReactDOM.createPortal(modalContent, document.getElementById('modal-root') as HTMLElement);
  } else {
    return null;
  }
}

export default Modal;
