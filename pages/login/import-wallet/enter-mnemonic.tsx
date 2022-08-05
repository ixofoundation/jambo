import { ChangeEvent, ClipboardEvent, FormEvent, Fragment, useState } from 'react';
import type { NextPage } from 'next';
import Head from 'next/head';
import cls from 'classnames';

import utilsStyles from '@styles/utils.module.scss';
import styles from '@styles/loginPage.module.scss';
import Header from '@components/header/header';
import Footer from '@components/footer/footer';
import { pushNewRoute } from '@utils/router';
import Paste from '@icons/paste.svg';
import { pasteFromClipboard } from '@utils/persistence';
import Input from '@components/input/input';

const finalWords = ['List', 'Football', 'Vehicle', 'Lounge', 'Guitar', 'Name', 'Chair', 'Autumn', 'Keyboard', 'Superconductor', 'Good', 'Girl'];

const EnterMnemonic: NextPage = () => {
	const [words, setWords] = useState(finalWords.map(w => ''));

	const onNext = words.filter(w => w.trim() != '').length != 12 ? null : () => pushNewRoute('/login/set-wallet');

	const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
		const { name, value } = event.target;
		setWords(words.map((word, i) => (i.toString() === name ? value : word)));
	};

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		onNext && onNext();
	};

	const handlePaste = (event: ClipboardEvent<HTMLInputElement>, index: number) => {
		event.preventDefault();
		const text = event.clipboardData.getData('text');
		const list = text
			.trim()
			.split(' ')
			.map(w => w.trim().replaceAll(',', '').toLocaleLowerCase());
		if (list.length < 1) return;
		if (list.length === 1) return setWords(words.map((w, i) => (i === index ? list[0] : w)));
		setWords(words.map((w, i) => (i < list.length ? list[i] : '')));
	};

	return (
		<>
			<Head>
				<title>EarthDay</title>
				<meta name="description" content="EarthDay" />
			</Head>

			<Header pageTitle="Import existing mnemonic" />

			<main className={cls(utilsStyles.main, utilsStyles.columnSpaceEvenlyCentered)}>
				<div className={styles.mnemonicsWrapper}>
					<h2 className={styles.mnemonicTitle}>Enter mnemonic phrase:</h2>
					<form onSubmit={handleSubmit} autoComplete="none" className={styles.mnemonicForm}>
						{finalWords.map((word, i) => (
							<Fragment key={word + i}>
								<p>{`${i + 1}.`}</p>
								<Input name={i.toString()} required onChange={handleChange} value={words[i]} onPaste={e => handlePaste(e, i)} />
							</Fragment>
						))}
					</form>
					<div className={styles.copyContainer}>
						<Paste width="20px" height="20px" />
						<p>Paste into any field</p>
					</div>
				</div>
			</main>

			<Footer onBackUrl="/login/create-wallet" onForward={onNext} />
		</>
	);
};

export default EnterMnemonic;
