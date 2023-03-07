import { useRouter } from 'next/router';
import type { NextPage } from 'next';
import cls from 'classnames';

import utilsStyles from '@styles/utils.module.scss';
import styles from '@styles/termsAndConditionsPage.module.scss';
import Header from '@components/Header/Header';
import Footer from '@components/Footer/Footer';
import config from '@constants/config.json';
import Head from '@components/Head/Head';

const TermsAndConditions: NextPage = () => {
  const { replace } = useRouter();

  if (!config.termsAndConditions) replace('/settings');

  return (
    <>
      <Head title='TermsAndConditions' description={config.siteDescriptionMeta} />

      <Header allowBack />

      <main className={cls(utilsStyles.main, utilsStyles.columnJustifyCenter, styles.termsAndConditions)}>
        <div className={utilsStyles.spacer3Flex} />
        <h2 className={styles.title}>Terms And Conditions</h2>
        <p className={styles.text} dangerouslySetInnerHTML={{ __html: config.termsAndConditions }} />
      </main>
      <Footer showAccountButton showActionsButton />
    </>
  );
};

export default TermsAndConditions;
