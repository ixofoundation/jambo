import type { NextPage } from 'next';
import Head from 'next/head';
import cls from 'classnames';

import utilsStyles from '@styles/utils.module.scss';
import styles from '@styles/aboutPage.module.scss';
import Header from '@components/header/header';
import Footer from '@components/footer/footer';
import config from '@constants/config.json';

const About: NextPage = () => {
	return (
		<>
			<Head>
				<title>About</title>
				<meta name="description" content={config.about} />
			</Head>

			<Header />

			<main className={cls(utilsStyles.main, utilsStyles.columnJustifyCenter, styles.about)}>
				<div className={utilsStyles.spacerFlex} />
				<h2 className={styles.title}>About</h2>
				<p className={styles.text}>{config.about}</p>
				{/* <h2 className={styles.title}>Account History</h2> */}

				<Footer onBackUrl="/" />
				<div className={utilsStyles.spacerFlex} />
				<div className={utilsStyles.spacerFlex} />
			</main>
		</>
	);
};

export default About;
