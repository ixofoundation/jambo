import type { NextPage } from 'next';
import Head from 'next/head';
import Link from 'next/link';

import styles from '@styles/Home.module.scss';
import Header from '@components/header';
import Footer from '@components/footer';
import Button from '@components/button/button';
import ConfigureProperty, { PropertyInputTypes } from '@components/configure-property/configure-property';
import { getAllCSSVariableNames, getElementCSSVariables } from '@utils/styles';

const Configure: NextPage = () => {
	const getAllProperties = () => {
		if (typeof window !== 'undefined') {
			console.log(':root variables', getElementCSSVariables(getAllCSSVariableNames(), document.documentElement));
		}
	};

	return (
		<div className={styles.container}>
			<Head>
				<title>EarthDay: Configure</title>
				<meta name="description" content="EarthDay configuration" />
			</Head>

			<Header />

			<main className={styles.main}>
				<h1 className={styles.title}>Configuration</h1>
				<p>
					Go to{' '}
					<Link href="/">
						<a className={styles.link}>Home</a>
					</Link>{' '}
					page
				</p>
				<br />
				<br />
				<Button label="button with radius" />
				<ConfigureProperty propertyName="--button-border-radius" propertyInputType={PropertyInputTypes.NUMBER} />
				<ConfigureProperty propertyName="--accent-color" propertyInputType={PropertyInputTypes.COLOR} />
				<br />
				<Button label="console.log new variables" onClick={getAllProperties} />
			</main>

			<Footer />
		</div>
	);
};

export default Configure;
