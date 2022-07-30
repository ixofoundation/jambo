import { useContext } from 'react';
import type { NextPage } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import cls from 'classnames';

import utilsStyles from '@styles/utils.module.scss';
import Header from '@components/header/header';
import Footer from '@components/footer/footer';
import Plus from '@icons/plus.svg';
import { ConfigContext } from '@contexts/config';
import ButtonRound from '@components/button-round/button-round';

const Actions: NextPage = () => {
	const {
		config: { actions, siteName },
	} = useContext(ConfigContext);

	return (
		<>
			<Head>
				<title>EarthDay: Configure</title>
				<meta name="description" content="EarthDay configuration" />
			</Head>

			<Header pageTitle="User Actions" />

			<main className={cls(utilsStyles.main, { [utilsStyles.columnSpaceEvenlyCentered]: true })}>
				{actions.length < 1 ? (
					<Link href="/set-actions/new-action">
						<a>
							<ButtonRound label={`Create user actions for ${siteName}`}>
								<Plus width="22px" height="22px" />
							</ButtonRound>
						</a>
					</Link>
				) : (
					actions.map(action => <div>{action}</div>)
				)}
			</main>

			<Footer onBackUrl="/" onCorrect={null} />
		</>
	);
};

export default Actions;
