import { useState, ChangeEvent, FormEvent, RefObject } from 'react';

import styles from './WalletForm.module.scss';
import Input from '@components/Input/Input';

type HeaderProps = {
  onSubmit: () => void;
  submitRef?: RefObject<HTMLButtonElement>;
};

const defaultFormFields = {
  nickname: '',
  password: '',
  confirmPassword: '',
};

const WalletForm = ({ onSubmit, submitRef }: HeaderProps) => {
  const [formFields, setFormFields] = useState(defaultFormFields);
  const { nickname, password, confirmPassword } = formFields;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (password !== confirmPassword) return alert('Your passwords do not match');

    try {
      await onSubmit();
      setFormFields(defaultFormFields);
    } catch (error) {
      console.log('form error: ', error);
    }
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setFormFields((currentFields) => ({ ...currentFields, [name]: value }));
  };

  return (
    <form onSubmit={handleSubmit} className={styles.walletForm} autoComplete='none'>
      <Input label='Wallet nickname:' name='nickname' required onChange={handleChange} value={nickname} />
      <Input
        label='Enter Password:'
        type='password'
        name='password'
        required
        onChange={handleChange}
        value={password}
        autoComplete='new-password'
      />
      <Input
        label='Confirm Password:'
        type='password'
        name='confirmPassword'
        required
        onChange={handleChange}
        value={confirmPassword}
        autoComplete='new-password'
      />
      <button type='submit' ref={submitRef} />
    </form>
  );
};

export default WalletForm;
