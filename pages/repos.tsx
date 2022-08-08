import { useEffect, useContext } from 'react';
import type { NextPage } from 'next';
import Head from 'next/head';
import cls from 'classnames';
import { Octokit } from '@octokit/rest';
import { useSession, signIn, signOut } from 'next-auth/react';

import utilsStyles from '@styles/utils.module.scss';
import Header from '@components/header/header';
import Footer from '@components/footer/footer';
import { ReposContext } from '@contexts/repositories';

const Repos: NextPage = () => {
	const { repositories, updateRepositories } = useContext(ReposContext);
	const { data: session, status } = useSession<false>();

	const getGithubRepos = async () => {
		if (!session?.accessToken) return;
		const octokit = new Octokit({ auth: session?.accessToken, userAgent: 'earthport' });
		const forks = await octokit.rest.repos.listForks({ owner: 'silent-sybber', repo: 'earthport' });
		const data = await octokit.rest.repos.listForAuthenticatedUser({ since: '2022-05-01T00:00:00' });
		updateRepositories(
			true,
			data.data.filter(repo => repo.fork == true && forks.data.some(fork => fork.id == repo.id)),
		);
	};

	const forkEarthPort = async () => {
		if (!session?.accessToken) return;
		const octokit = new Octokit({ auth: session?.accessToken, userAgent: 'earthport' });
		const data = await octokit.rest.repos.createFork({ owner: 'silent-sybber', repo: 'earthport', name: 'earthport-fork-test' });
		console.log({ data });
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

			<main className={cls(utilsStyles.main, utilsStyles.columnJustifyCenter)}>
				{session ? (
					<div>
						<p>Signed in {session.user?.name}</p>
						{repositories.map(repo => (
							<p key={repo.name}>{repo.name}</p>
						))}
						<button onClick={() => signOut()}>SIGN OUT</button>
						<br />
						<br />
						<button onClick={getGithubRepos}>GET DATA</button>
						<br />
						<br />
						<button onClick={forkEarthPort}>Fork Eartport</button>
					</div>
				) : (
					<div>
						<p>Not signed in</p>
						<button onClick={() => signIn('github')}>SIGN IN</button>
					</div>
				)}
			</main>

			<Footer />
		</>
	);
};

export default Repos;
