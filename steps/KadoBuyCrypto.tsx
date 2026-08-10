import { FC, useEffect, useState } from 'react';
import cls from 'classnames';

import { STEPS, StepConfigType, StepDataType } from 'types/steps';
import KadoModal from '@components/KadoModal/KadoModal';
import utilsStyles from '@styles/utils.module.scss';
import styles from '@styles/stepsPages.module.scss';
import Header from '@components/Header/Header';
import Footer from '@components/Footer/Footer';
import { PRODUCT } from 'types/kado';

type KadoStepProps = {
  onSuccess: (data: StepDataType<STEPS.kado_buy_crypto>) => void;
  onBack?: () => void;
  config?: StepConfigType<STEPS.kado_buy_crypto>;
  data?: StepDataType<STEPS.kado_buy_crypto>;
  header?: string;
};

const KadoBuyCrypto: FC<KadoStepProps> = ({ onSuccess, onBack, header }) => {
  const [kadoVisible, setKadoVisible] = useState(true);

  function handleCloseKado() {
    setKadoVisible(false);
    if (onBack && typeof onBack === 'function') {
      onBack();
    }
  }

  useEffect(() => {
    setKadoVisible(true);
  }, []);

  return (
    <>
      <Header header={header} />

      <main className={cls(utilsStyles.main, utilsStyles.columnJustifyCenter, styles.stepContainer)}>
        <div className={styles.stepTitle}>Buy Crypto with Kado</div>
        <KadoModal visible={kadoVisible} onClose={handleCloseKado} productList={[PRODUCT.BUY]} />
      </main>

      <Footer onBack={handleCloseKado} onForward={() => onSuccess({})} />
    </>
  );
};

export default KadoBuyCrypto;
