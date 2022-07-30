import { useContext } from 'react';
import type { NextPage } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import cls from 'classnames';

import utilsStyles from '@styles/utils.module.scss';
import styles from '@styles/actionsPage.module.scss';
import Header from '@components/header/header';
import Footer from '@components/footer/footer';
import Star from '@icons/star.svg';
import { ConfigContext } from '@contexts/config';
import ButtonRound, { BUTTON_ROUND_COLOR, BUTTON_ROUND_SIZE } from '@components/button-round/button-round';
import FormInput from '@components/form-input/form-input';
import ImageInput from '@components/image-input/image-input';
import FormTextArea from '@components/form-text-area/form-text-area';

const StepsLibrary: NextPage = () => {
	const {
		config: { actions, siteName },
	} = useContext(ConfigContext);

	return (
		<div className={styles.actionCard}>
			<h2>Steps library</h2>
			<FormInput placeholder="Action name" className={styles.actionName} />
		</div>
	);
};

export default StepsLibrary;
