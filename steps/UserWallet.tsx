import React from 'react';
import cls from 'classnames';

import utilsStyles from '@styles/utils.module.scss';
import styles from '@styles/stepsPages.module.scss';
import Header from '@components/Header/Header';
import QueryCheck from '@components/UserWallets/QueryCheck';

const UserWallet = () => {
  return (
    <>
      <Header />
      <main className={cls(utilsStyles.main, utilsStyles.columnJustifyCenter, styles.stepContainer)}>
        <QueryCheck />
      </main>
    </>
  );
};

export default UserWallet;
