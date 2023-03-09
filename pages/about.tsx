import { useRouter } from 'next/router';
import type { NextPage } from 'next';
import cls from 'classnames';

import utilsStyles from '@styles/utils.module.scss';
import styles from '@styles/aboutPage.module.scss';
import Header from '@components/Header/Header';
import Footer from '@components/Footer/Footer';
import config from '@constants/config.json';
import Head from '@components/Head/Head';

const About: NextPage = () => {
  const { replace } = useRouter();

  if (!config.about) replace('/settings');

  return (
    <>
      <Head title='About' description={config.siteDescriptionMeta} />

      <Header />

      <main className={cls(utilsStyles.main, utilsStyles.columnJustifyCenter, styles.about)}>
        <div className={utilsStyles.spacer3Flex} />
        <h2 className={styles.title}>About</h2>
        <p className={styles.text} dangerouslySetInnerHTML={{ __html: config.about }} />
      </main>
      <Footer showAccountButton showActionsButton />
    </>
  );
};

export default About;
