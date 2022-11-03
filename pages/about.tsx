import type { NextPage } from 'next';
import cls from 'classnames';

import utilsStyles from '@styles/utils.module.scss';
import styles from '@styles/aboutPage.module.scss';
import Header from '@components/header/header';
import Footer from '@components/footer/footer';
import config from '@constants/config.json';
import Head from '@components/head/head';

const About: NextPage = () => {
	return (
		<>
			<Head title="About" description={config.siteDescriptionMeta} />

			<Header />

			<main className={cls(utilsStyles.main, utilsStyles.columnJustifyCenter, styles.about)}>
				<div className={utilsStyles.spacerFlex} />
				<h2 className={styles.title}>About</h2>
				<p className={styles.text} dangerouslySetInnerHTML={{ __html: config.about }} />

				{/* <h2 className={styles.title}>Account History</h2> */}

				<Footer onBackUrl="/" />
				<div className={utilsStyles.spacerFlex} />
				<div className={utilsStyles.spacerFlex} />
			</main>
		</>
	);
};

export default About;
