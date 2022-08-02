import { useContext, useState } from 'react';
import type { NextPage } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import cls from 'classnames';

import utilsStyles from '@styles/utils.module.scss';
import Header from '@components/header/header';
import Footer from '@components/footer/footer';
import ButtonRound, { BUTTON_ROUND_SIZE } from '@components/button-round/button-round';
import Eye from '@icons/eye.svg';
import ManRunning from '@icons/man_running.svg';
import Document from '@icons/document.svg';
import { ConfigContext } from '@contexts/config';
import { pushNewRoute } from '@utils/router';

const Configure: NextPage = () => {
	const [setDescriptionDone, setSetDescriptionDone] = useState(false);
	const { config } = useContext(ConfigContext);

	const checkStylesSet = config.setStylesDone;
	const checkActionsSet = config.actions.length > 0;
	const checkAllSet = checkStylesSet && checkActionsSet && setDescriptionDone ? () => pushNewRoute('/configure/set-up') : null;

	return (
		<>
			<Head>
				<title>EarthDay</title>
				<meta name="description" content="EarthDay" />
			</Head>

			<Header pageTitle="Create a new dApp" />

			<main className={cls(utilsStyles.main, utilsStyles.columnSpaceEvenlyCentered)}>
				<Link href="/configure/set-style">
					<a>
						<ButtonRound label="Set Style" size={BUTTON_ROUND_SIZE.large} successMark={checkStylesSet}>
							<Eye width="50px" height="50px" />
						</ButtonRound>
					</a>
				</Link>
				<Link href="/configure/set-actions">
					<a>
						<ButtonRound label="Set user actions" size={BUTTON_ROUND_SIZE.large} successMark={checkActionsSet}>
							<ManRunning width="50px" height="50px" />
						</ButtonRound>
					</a>
				</Link>
				<Link href="">
					<a>
						<ButtonRound label="Set Description" size={BUTTON_ROUND_SIZE.large} successMark={setDescriptionDone} onClick={() => setSetDescriptionDone(true)}>
							<Document width="50px" height="50px" />
						</ButtonRound>
					</a>
				</Link>
			</main>

			<Footer onForward={checkAllSet} />
		</>
	);
};

export default Configure;
