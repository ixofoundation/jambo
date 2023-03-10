import { FC, FormEvent, useState, useEffect, useContext } from 'react';
import cls from 'classnames';

import utilsStyles from '@styles/utils.module.scss';
import styles from '@styles/stepsPages.module.scss';
import ValidatorCard from '@components/ValidatorCard/ValidatorCard';
import ValidatorList from '@components/ValidatorList/ValidatorList';
import IconText from '@components/IconText/IconText';
import Header from '@components/Header/Header';
import Footer from '@components/Footer/Footer';
import SadFace from '@icons/sad_face.svg';
import { VALIDATOR, VALIDATOR_CONFIG } from 'types/validators';
import { StepDataType, STEPS } from 'types/steps';
import { WalletContext } from '@contexts/wallet';

type ValidatorAddressProps = {
  onSuccess: (data: StepDataType<STEPS.get_validator_delegate>) => void;
  onBack?: () => void;
  data?: StepDataType<STEPS.get_validator_delegate>;
  header?: string;
  config: VALIDATOR_CONFIG;
  excludeValidators: string | string[];
};

const ValidatorAddress: FC<ValidatorAddressProps> = ({ onSuccess, onBack, header, config, excludeValidators }) => {
  const [selectedValidator, setSelectedValidator] = useState<VALIDATOR | null>(null);
  const { wallet } = useContext(WalletContext);

  useEffect(() => {
    if (!config.showValidatorDetails && formIsValid()) {
      handleSubmit(null);
    }
  }, [selectedValidator]);

  const formIsValid = () => selectedValidator?.address?.length;

  const handleSubmit = (event: FormEvent<HTMLFormElement> | null) => {
    event?.preventDefault();
    if (!formIsValid()) return alert('A validator must be selected');
    onSuccess({ validator: selectedValidator as VALIDATOR });
  };

  const handleValidatorClick = (validator: VALIDATOR) => () => {
    setSelectedValidator(validator);
  };

  const unselectValidator = () => {
    setSelectedValidator(null);
  };

  if (config.showValidatorDetails && selectedValidator?.address)
    return (
      <>
        <Header header={header} />

        <main className={cls(utilsStyles.main, utilsStyles.columnJustifyCenter, styles.stepContainer)}>
          <form className={styles.stepsForm} onSubmit={handleSubmit} autoComplete='none'>
            <ValidatorCard validator={selectedValidator} />
          </form>
          <div className={utilsStyles.spacer3} />
        </main>

        <Footer
          onBack={unselectValidator}
          onBackUrl={onBack ? undefined : ''}
          onForward={formIsValid() ? () => handleSubmit(null) : null}
        />
      </>
    );

  return (
    <>
      <Header header={header} />

      <main className={cls(utilsStyles.main, utilsStyles.columnJustifyCenter, styles.stepContainer)}>
        {!!config.requireFunds && !wallet?.balances?.balances?.length ? (
          <IconText title="You don't have any tokens to stake." Img={SadFace} imgSize={50} />
        ) : (
          <form className={styles.stepsForm} onSubmit={handleSubmit} autoComplete='none'>
            <ValidatorList
              label={config.label}
              allowFilters={!!config.allowFilters}
              delegatedValidatorsOnly={config.delegatedValidatorsOnly}
              onValidatorClick={handleValidatorClick}
              excludeValidators={[excludeValidators].flat()}
              noValidators={
                <IconText title="You don't have any tokens delegated for this account." Img={SadFace} imgSize={50} />
              }
            />
          </form>
        )}
      </main>

      <Footer
        onBack={onBack}
        onBackUrl={onBack ? undefined : ''}
        onForward={formIsValid() ? () => handleSubmit(null) : null}
      />
    </>
  );
};

export default ValidatorAddress;
