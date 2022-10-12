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
				<title>EarthDay</title>
				<meta name="description" content="EarthDay" />
			</Head>

			<Header />

			<main className={cls(utilsStyles.main)}>
				<h2 className={styles.title}>About</h2>
				<p className={styles.text}>{config.about}</p>
				{/* <h2 className={styles.title}>Account History</h2> */}
			</main>

			<Footer onBackUrl="/" />
		</>
	);
};

export default About;
