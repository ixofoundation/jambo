import { ChangeEvent, FC, FormEvent, useState } from 'react';
import cls from 'classnames';

import utilsStyles from '@styles/utils.module.scss';
import styles from '@styles/stepsPages.module.scss';
import TextArea from '@components/TextArea/TextArea';
import Header from '@components/Header/Header';
import Footer from '@components/Footer/Footer';
import { StepDataType, STEPS } from 'types/steps';

type LongTextInputProps = {
  onSuccess: (data: StepDataType<STEPS.define_proposal_description>) => void;
  onBack?: () => void;
  // config: StepConfigType<STEPS.define_proposal_description>;
  data?: StepDataType<STEPS.define_proposal_description>;
  header?: string;
};

const LongTextInput: FC<LongTextInputProps> = ({ onSuccess, onBack, data, header }) => {
  const [text, setText] = useState(data?.description);

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setText(event.target.value);
  };

  const formIsValid = () => (text ?? '').length > 10;

  const handleSubmit = (event: FormEvent<HTMLFormElement> | null) => {
    event?.preventDefault();
    if (!formIsValid()) return alert('Short text must be provided');
    onSuccess({ description: text });
  };

  return (
    <>
      <Header header={header} />

      <main className={cls(utilsStyles.main, utilsStyles.columnJustifyCenter, styles.stepContainer)}>
        <form className={styles.stepsForm} onSubmit={handleSubmit} autoComplete='none'>
          <p className={styles.label}>Proposal Description</p>
          <TextArea
            name='address'
            required
            onChange={handleChange}
            value={text}
            cols={5}
            className={styles.stepInput}
          />
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

export default LongTextInput;
