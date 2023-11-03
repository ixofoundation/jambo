import { FC } from 'react';
import cls from 'classnames';

import utilsStyles from '@styles/utils.module.scss';
import styles from '@styles/stepsPages.module.scss';
import WalletCard from '@components/CardWallet/CardWallet';
import Header from '@components/Header/Header';
import Footer from '@components/Footer/Footer';
import Loader from '@components/Loader/Loader';
import WalletImg from '@icons/wallet.svg';
import { pushNewRoute } from '@utils/router';
import { StepConfigType, StepDataType, STEPS } from 'types/steps';
import React from 'react';

type EmptyStepsProps = {
  onSuccess: (data: StepDataType<STEPS.privacy_policy>) => void;
  onBack?: () => void;
  data?: StepDataType<STEPS.privacy_policy>;
  header?: string;
};

const Waiver: FC<EmptyStepsProps> = ({ onSuccess, onBack, header, data }) => {
  return (
    <>
      <Header />
      <main className={cls(utilsStyles.main, utilsStyles.columnJustifyCenter, styles.stepContainer)}>
        <div className={utilsStyles.spacer3} />
          <>Hello World!</>
        <div className={utilsStyles.spacer3} />
      </main>
      <Footer onBackUrl='/' backLabel='Home' />
    </>
  );
};

export default Waiver;
