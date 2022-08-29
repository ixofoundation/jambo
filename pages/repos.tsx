import { useEffect, useContext } from 'react';
import type { NextPage } from 'next';
import Head from 'next/head';
import { useSession, signIn, signOut } from 'next-auth/react';

import utilsStyles from '@styles/utils.module.scss';
import styles from '@styles/reposPage.module.scss';
import Header from '@components/header/header';
import Footer from '@components/footer/footer';
import { ReposContext } from '@contexts/repositories';
import { ConfigContext } from '@contexts/config';
import { forkEarthPort, getEartportForkedGithubRepos, newForkNetlifyAddress, updateRepoConfig, updateRepoVariables } from '@utils/repositories';
import Button from '@components/button/button';
import Card from '@components/card/card';
import ButtonRound from '@components/button-round/button-round';
import Plus from '@icons/plus.svg';
import ExternalLink from '@icons/external_link.svg';

const Repos: NextPage = () => {
	const { repositories, updateRepositories } = useContext(ReposContext);
	const { config } = useContext(ConfigContext);
	const { data: session, status } = useSession<false>();

	const getGithubRepos = async () => {
		const repos = await getEartportForkedGithubRepos(session);
		// console.log({ repos });
		updateRepositories(true, repos ?? []);
	};

	useEffect(() => {
		if (session) getGithubRepos();
	}, [session?.accessToken]);

	return (
		<>
			<Head>
				<title>EarthDay</title>
				<meta name="description" content="EarthDay" />
			</Head>

			<Header />

			<main className={utilsStyles.main}>
				{session ? (
					<>
						<span>Hi {session.user?.name} </span>
						<Button label="SIGN OUT" onClick={() => signOut()} />
						<h2 className={styles.repoTitle}>Earthport Forks:</h2>
						{repositories.map((repo, i) => (
							<Card key={repo.name + i} className={styles.repoCard}>
								<div className={styles.repoCardTitleContainer}>
									<h3 className={styles.repoCardTitle}>{repo.name}</h3>
									<a href={repo.html_url} target="_blank" rel="noreferrer noopener">
										<ExternalLink width="22px" height="22px" />
									</a>
								</div>
								<div>
									<Button label="Update Config" onClick={() => updateRepoConfig(session, repo, config)} />
									<Button label="Update Variables" onClick={() => updateRepoVariables(session, repo)} />
								</div>
							</Card>
						))}
						{/* <a href={newForkNetlifyAddress()} target="_blank" rel="noreferrer noopener">
							<ButtonRound label={`New dApp on Netlify`} className={styles.repoAddButton}>
								<Plus width="22px" height="22px" />
							</ButtonRound>
						</a> */}
						<ButtonRound label={`Fork Earthport`} className={styles.repoAddButton} onClick={() => forkEarthPort(session)}>
							<Plus width="22px" height="22px" />
						</ButtonRound>
					</>
				) : (
					<>
						<p>Not signed in </p>
						<Button label="SIGN IN" onClick={() => signIn('github')} />
					</>
				)}
			</main>

			<Footer />
		</>
	);
};

export default Repos;
