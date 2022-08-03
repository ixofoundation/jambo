import type { NextPage } from 'next';
import Head from 'next/head';
import cls from 'classnames';

import utilsStyles from '@styles/utils.module.scss';
import styles from '@styles/aboutPage.module.scss';
import Header from '@components/header/header';
import Footer from '@components/footer/footer';

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
				<p className={styles.text}>
					Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex
					ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt
					mollit anim id est laborum.
				</p>
				<h2 className={styles.title}>Account History</h2>
			</main>

			<Footer onBackUrl="/" />
		</>
	);
};

export default About;
