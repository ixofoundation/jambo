import { ChangeEvent, FC, FormEvent, useState } from 'react';
import cls from 'classnames';

import utilsStyles from '@styles/utils.module.scss';
import styles from '@styles/stepsPages.module.scss';
import InputWithSuffixIcon from '@components/InputWithSuffixIcon/InputWithSuffixIcon';
import Header from '@components/Header/Header';
import Footer from '@components/Footer/Footer';
import Paste from '@icons/paste.svg';
import { StepConfigType, StepDataType, STEPS } from 'types/steps';

type ShortTextInputProps = {
  onSuccess: (data: StepDataType<STEPS.define_proposal_title>) => void;
  onBack?: () => void;
  // config: StepConfigType<STEPS.define_proposal_title>;
  data?: StepDataType<STEPS.define_proposal_title>;
  header?: string;
};

const ShortTextInput: FC<ShortTextInputProps> = ({ onSuccess, onBack, data, header }) => {
  const [text, setText] = useState(data?.title);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    setText(event.target.value);
  };

  const formIsValid = () => (text ?? '').length > 0;

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
          <p className={styles.label}>The title of your proposal:</p>
          <InputWithSuffixIcon name='address' required onChange={handleChange} value={text} icon={Paste} />
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
