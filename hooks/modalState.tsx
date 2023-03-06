import { useState } from 'react';

type ModalState = [boolean, () => void, () => void];

const useModalState = (defaultState: boolean = false): ModalState => {
  const [modalState, setModalState] = useState<boolean>(!!defaultState);

  const showModal = () => setModalState(true);

  const hideModal = () => setModalState(false);

  return [modalState, showModal, hideModal];
};

export default useModalState;
