import { useState } from 'react';

type ModalState = [boolean, () => void, () => void];

const useModalState = (defaultState: boolean = false): ModalState => {
  const [modalState, setModalState] = useState<boolean>(!!defaultState);

  const showModal = (callback?: Function) => {
    setModalState(true);
    if (callback && typeof callback === 'function') callback();
  };

  const hideModal = (callback?: Function) => {
    setModalState(false);
    if (callback && typeof callback === 'function') callback();
  };

  return [modalState, showModal, hideModal];
};

export default useModalState;
