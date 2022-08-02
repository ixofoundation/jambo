import type { NextPage } from 'next';
import Head from 'next/head';
import cls from 'classnames';

import utilsStyles from '@styles/utils.module.scss';
import Header from '@components/header/header';
import Footer from '@components/footer/footer';
import ConfigureVariable, { PropertyInputTypes } from '@components/configure-variable/configure-variable';
import { pushNewRoute } from '@utils/router';

const SetStyle: NextPage = () => {
	return (
		<>
			<Head>
				<title>EarthDay: Configure</title>
				<meta name="description" content="EarthDay configuration" />
			</Head>

			<Header pageTitle="Choose Color" />

			<main className={cls(utilsStyles.main, utilsStyles.columnSpaceEvenlyCentered)}>
				<ConfigureVariable propertyName="--accent-color" propertyInputType={PropertyInputTypes.COLOR} />
			</main>

			<Footer onBackUrl="/configure/set-style" onCorrect={() => pushNewRoute('/configure/set-style')} />
		</>
	);
};

export default SetStyle;
