import { useRef } from 'react';
import type { NextPage } from 'next';
import Head from 'next/head';
import cls from 'classnames';

import utilsStyles from '@styles/utils.module.scss';
import Header from '@components/header/header';
import Footer from '@components/footer/footer';
import WalletForm from '@components/wallet-form/wallet-form';
import { pushNewRoute } from '@utils/router';

const SetWallet: NextPage = () => {
	const submitRef = useRef<HTMLButtonElement>(null);

	const onSubmit = () => {
		pushNewRoute('/');
	};

	return (
		<>
			<Head>
				<title>EarthDay</title>
				<meta name="description" content="EarthDay" />
			</Head>

			<Header pageTitle="Set wallet details" />

			<main className={cls(utilsStyles.main, utilsStyles.columnSpaceEvenlyCentered)}>
				<WalletForm onSubmit={onSubmit} submitRef={submitRef} />
			</main>

			<Footer onBackUrl="" onCorrect={() => submitRef.current?.click()} />
		</>
	);
};

export default SetWallet;
