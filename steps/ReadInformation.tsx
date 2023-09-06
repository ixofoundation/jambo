import { FC, FormEvent, useMemo } from 'react';
import { sanitize } from 'dompurify';
import cls from 'classnames';

import utilsStyles from '@styles/utils.module.scss';
import styles from '@styles/stepsPages.module.scss';
import ImageWithFallback from '@components/ImageFallback/ImageFallback';
import Header from '@components/Header/Header';
import Footer from '@components/Footer/Footer';
import { StepConfigType, StepDataType, STEPS } from 'types/steps';

type InformationProps = {
  onSuccess: (data: StepDataType<STEPS.read_information>) => void;
  onBack?: () => void;
  data?: StepDataType<STEPS.read_information>;
  config: StepConfigType<STEPS.read_information>;
  header?: string;
};

const Information: FC<InformationProps> = ({ onSuccess, onBack, config, data, header }) => {
  const content = useMemo(
    () => (config.description ? sanitize(config.description, { USE_PROFILES: { html: true } }) : undefined),
    [config.description],
  );

  const formIsValid = () => true;

  const handleSubmit = (event: FormEvent<HTMLFormElement> | void) => {
    event?.preventDefault();
    if (!formIsValid()) return alert('Address must be provided');
    onSuccess({ read: true });
  };

  return (
    <>
      <Header header={header} />

      <main className={cls(utilsStyles.main, utilsStyles.columnJustifyCenter, styles.stepContainer)}>
        <form className={styles.stepsForm} onSubmit={handleSubmit} autoComplete='none'>
          <div className={styles.marginX20}>
            {!!config?.image && (
              <>
                <ImageWithFallback
                  height={98}
                  width={98}
                  src={config.image}
                  fallbackSrc='/images/actions/fallback.png'
                />
                <div className={utilsStyles.spacer2} />
              </>
            )}
            {!!config.title && (
              <>
                <h3 className={styles.label}>{config.title}</h3>
                <div className={utilsStyles.spacer1} />
              </>
            )}
            {content && <p className={styles.paragraph} dangerouslySetInnerHTML={{ __html: content }} />}
          </div>
        </form>
      </main>

      <Footer onBack={onBack} onBackUrl={onBack ? undefined : ''} onForward={formIsValid() ? handleSubmit : null} />
    </>
  );
};

export default Information;
