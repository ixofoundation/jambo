import type { NextPage } from 'next';
import Head from 'next/head';
import cls from 'classnames';

import utilsStyles from '@styles/utils.module.scss';
import styles from '@styles/loginPage.module.scss';
import Header from '@components/header/header';
import Footer from '@components/footer/footer';
import { pushNewRoute } from '@utils/router';
import Copy from '@icons/copy.svg';
import { copyToClipboard } from '@utils/persistence';

const words = ['List', 'Football', 'Vehicle', 'Lounge', 'Guitar', 'Name', 'Chair', 'Autumn', 'Keyboard', 'Superconductor', 'Good', 'Girl'];

const NewMnemonic: NextPage = () => {
	const onCopy = () => copyToClipboard(words.join(' ').toLocaleLowerCase());

	return (
		<>
			<Head>
				<title>EarthDay</title>
				<meta name="description" content="EarthDay" />
			</Head>

			<Header pageTitle="Create new mnemonic" />

			<main className={cls(utilsStyles.main, utilsStyles.columnSpaceEvenlyCentered)}>
				<div className={styles.mnemonicsWrapper}>
					<h2 className={styles.mnemonicTitle}>Backup mnemonic phrase:</h2>
					<div className={styles.mnemonics}>
						{words.map((word, i) => (
							<div key={word + i} className={styles.mnemonic}>
								{word}
							</div>
						))}
					</div>
					<div className={styles.copyContainer} onClick={onCopy}>
						<Copy width="20px" height="20px" />
						<p>Copy to clipboard</p>
					</div>
				</div>
			</main>

			<Footer onBackUrl="/login/create-wallet" onForward={() => pushNewRoute('/login/create-wallet/confirm-mnemonic')} />
		</>
	);
};

export default NewMnemonic;
