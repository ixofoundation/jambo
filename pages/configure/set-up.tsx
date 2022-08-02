import { useContext, useState } from 'react';
import type { NextPage } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import cls from 'classnames';

import utilsStyles from '@styles/utils.module.scss';
import Header from '@components/header/header';
import Footer from '@components/footer/footer';
import ButtonRound, { BUTTON_ROUND_SIZE } from '@components/button-round/button-round';
import ArrowsHorizontal from '@icons/arrows_horizontal.svg';
import Search from '@icons/search.svg';
import Document from '@icons/document.svg';
import { ConfigContext } from '@contexts/config';
import { pushNewRoute } from '@utils/router';

const SetUp: NextPage = () => {
	const [setFreeGrant, setSetFreeGrant] = useState(false);
	const [setDomainUrl, setSetDomainUrl] = useState(false);
	const [listDApp, setListDApp] = useState(false);

	// const { config } = useContext(ConfigContext);
	// const checkStylesSet = config.setStylesDone;
	// const checkActionsSet = config.actions.length > 0;

	const checkAllSet = setFreeGrant && setDomainUrl && listDApp ? () => pushNewRoute('/configure/publish') : null;

	return (
		<>
			<Head>
				<title>EarthDay</title>
				<meta name="description" content="EarthDay" />
			</Head>

			<Header pageTitle="Set up" />

			<main className={cls(utilsStyles.main, utilsStyles.columnSpaceEvenlyCentered)}>
				<Link href="">
					<a>
						<ButtonRound label="Set up FeeGrant" size={BUTTON_ROUND_SIZE.large} successMark={setFreeGrant} onClick={() => setSetFreeGrant(true)}>
							<ArrowsHorizontal width="50px" height="50px" />
						</ButtonRound>
					</a>
				</Link>
				<Link href="">
					<a>
						<ButtonRound label="Sety domain URL" size={BUTTON_ROUND_SIZE.large} successMark={setDomainUrl} onClick={() => setSetDomainUrl(true)}>
							<Search width="50px" height="50px" />
						</ButtonRound>
					</a>
				</Link>
				<Link href="">
					<a>
						<ButtonRound label="List on dApp Store" size={BUTTON_ROUND_SIZE.large} successMark={listDApp} onClick={() => setListDApp(true)}>
							<Document width="50px" height="50px" />
						</ButtonRound>
					</a>
				</Link>
			</main>

			<Footer onForward={checkAllSet} onBackUrl="/configure" />
		</>
	);
};

export default SetUp;
