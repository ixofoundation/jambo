import type { NextPage } from 'next';
import Head from 'next/head';
import cls from 'classnames';

import utilsStyles from '@styles/utils.module.scss';
import Header from '@components/header/header';
import Footer from '@components/footer/footer';
import ConfigureProperty, { PropertyInputTypes } from '@components/configure-property/configure-property';
import { pushNewRoute } from '@utils/router';

const SetFont: NextPage = () => {
	return (
		<>
			<Head>
				<title>EarthDay: Configure</title>
				<meta name="description" content="EarthDay configuration" />
			</Head>

			<Header pageTitle="Choose Font" />

			<main className={cls(utilsStyles.main, utilsStyles.columnSpaceEvenlyCentered)}>
				<ConfigureProperty propertyName="--accent-color" propertyInputType={PropertyInputTypes.COLOR} />
			</main>

			<Footer onBackUrl="/set-style" onCorrect={() => pushNewRoute('/set-style')} />
		</>
	);
};

export default SetFont;
