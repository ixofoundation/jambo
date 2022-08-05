import type { NextPage } from 'next';
import Head from 'next/head';
import cls from 'classnames';

import utilsStyles from '@styles/utils.module.scss';
import typoStyles from '@styles/typography.module.scss';
import Header from '@components/header/header';
import Footer from '@components/footer/footer';
import Link from 'next/link';
import ButtonRound, { BUTTON_ROUND_SIZE } from '@components/button-round/button-round';
import Apple from '@icons/apple.svg';
import Google from '@icons/google.svg';
import Pencil from '@icons/pencil.svg';

const CreateWallet: NextPage = () => {
	return (
		<>
			<Head>
				<title>EarthDay</title>
				<meta name="description" content="EarthDay" />
			</Head>

			<Header pageTitle="Create new wallet" />

			<main className={cls(utilsStyles.main, utilsStyles.columnSpaceEvenlyCentered)}>
				<div>
					<Link href="/login/set-wallet">
						<a>
							<ButtonRound label="Sign in with Apple" size={BUTTON_ROUND_SIZE.large}>
								<Apple width="50px" height="50px" />
							</ButtonRound>
						</a>
					</Link>
					<p className={typoStyles.subText}>Powered with Web3Auth</p>
				</div>
				<div>
					<Link href="/login/set-wallet">
						<a>
							<ButtonRound label="Sign in with Google" size={BUTTON_ROUND_SIZE.large}>
								<Google width="50px" height="50px" />
							</ButtonRound>
						</a>
					</Link>
					<p className={typoStyles.subText}>Powered with Web3Auth</p>
				</div>
				<Link href="/login/create-wallet/new-mnemonic">
					<a>
						<ButtonRound label="Create new mnemonic" size={BUTTON_ROUND_SIZE.large}>
							<Pencil width="50px" height="50px" />
						</ButtonRound>
					</a>
				</Link>
			</main>

			<Footer onBackUrl="/login" />
		</>
	);
};

export default CreateWallet;
