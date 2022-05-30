import type { NextPage } from 'next';
import Head from 'next/head';
import Link from 'next/link';

import styles from '@styles/Home.module.css';
import Header from '@components/header';
import Footer from '@components/footer';

const ProtectEarth: NextPage = () => {
	return (
		<div className={styles.container}>
			<Head>
				<title>ProtectEarth</title>
				<meta name="description" content="ProtectEarth" />
				<link rel="icon" href="/favicon.ico" />
			</Head>

			<Header />

			<main className={styles.main}>
				<h1 className={styles.title}>Welcome to ProtectEarth!</h1>
				<p>
					Go to{' '}
					<Link href="/">
						<a className={styles.link}>EarthDay</a>
					</Link>{' '}
					page
				</p>
				<p>
					Go to{' '}
					<Link href="/saveEarth">
						<a className={styles.link}>SaveEarth</a>
					</Link>{' '}
					page
				</p>
			</main>

			<Footer />
		</div>
	);
};

export default ProtectEarth;
