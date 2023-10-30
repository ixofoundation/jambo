import { ChangeEvent, FC, FormEvent, useState } from 'react';
import cls from 'classnames';

import utilsStyles from '@styles/utils.module.scss';
import styles from '@styles/stepsPages.module.scss';
import Header from '@components/Header/Header';
import Footer from '@components/Footer/Footer';
import { StepDataType, STEPS } from 'types/steps';
import Input from '@components/Input/Input';

type ShortTextInputProps = {
  onSuccess: (data: StepDataType<STEPS.define_proposal_title>) => void;
  onBack?: () => void;
  // config: StepConfigType<STEPS.define_proposal_title>;
  data?: StepDataType<STEPS.define_proposal_title>;
  header?: string;
};

const ShortTextInput: FC<ShortTextInputProps> = ({ onSuccess, onBack, data, header }) => {
  const [text, setText] = useState(data?.title ?? '');

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    setText(event.target.value);
  };

  const formIsValid = () => (text ?? '').length > 2;

  const handleSubmit = (event: FormEvent<HTMLFormElement> | null) => {
    event?.preventDefault();
    if (!formIsValid()) return alert('Short text must be provided');
    onSuccess({ title: text });
  };

  return (
    <>
      <Header header={header} />

      <main className={cls(utilsStyles.main, utilsStyles.columnJustifyCenter, styles.stepContainer)}>
        <form className={styles.stepsForm} onSubmit={handleSubmit} autoComplete='none'>
          <p className={styles.label}>Proposal Title</p>
          <Input name='address' required onChange={handleChange} value={text} className={styles.stepInput} />
          <div className={utilsStyles.spacer10} />
        </form>
      </main>

      <Footer
        onBack={onBack}
        onBackUrl={onBack ? undefined : ''}
        onForward={formIsValid() ? () => handleSubmit(null) : null}
      />
    </>
  );
};

export default ShortTextInput;
