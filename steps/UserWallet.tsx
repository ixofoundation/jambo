import { FC } from 'react';
import cls from 'classnames';

import utilsStyles from '@styles/utils.module.scss';
import styles from '@styles/stepsPages.module.scss';
import Header from '@components/Header/Header';
import Loader from '@components/Loader/Loader';
import WalletQR from '@components/UserWallets/WalletQR';
import Join from '@components/UserWallets/Join';
import UserWallets from '@components/UserWallets/UserWallets';


type EmptyStepsProps = {
  loading?: boolean;
  signedIn?: boolean;
};

const EmptySteps: FC<EmptyStepsProps> = ({ loading = false, signedIn = true }) => {

  return (
    <>
      <Header />
      <main className={cls(utilsStyles.main, utilsStyles.columnJustifyCenter, styles.stepContainer)}>
        <div className={utilsStyles.spacer3} />
        {loading ? (
          <Loader />
        ) : !signedIn ? (
          <p>empty</p>
        ) : (
          <div>
            {/* <p className={styles.centerTxt} >Connect your Wallet.</p> */}0
            <div>
              <WalletQR />
            </div>
          </div>
        )}
        <div className={utilsStyles.spacer3} />
      </main>
      {/* <Footer onBackUrl='/' backLabel='Home' /> */}
    </>
  );
};

export default EmptySteps;
