import { Session } from 'next-auth';
import { Octokit } from '@octokit/rest';

import localConfig from '@constants/config.json';
import { getAllVariables } from './styles';
import { utf16_to_b64 } from './encoding';
import { Repository } from '@contexts/repositories';
import { ConfigInfo } from '@contexts/config';

export const newForkNetlifyAddress = () => `https://app.netlify.com/start/deploy?repository=https://github.com/${localConfig.gitRepositoryOwner}/${localConfig.gitRepositoryName}`;

export const getEartportForkedGithubRepos = async (session: Session | null) => {
	if (!session?.accessToken) return;
	const octokit = new Octokit({ auth: session?.accessToken, userAgent: localConfig.gitRepositoryUserAgent });
	const forks = await octokit.rest.repos.listForks({ owner: localConfig.gitRepositoryOwner, repo: localConfig.gitRepositoryName });
	const reposList = await octokit.rest.repos.listForAuthenticatedUser({ since: '2022-05-01T00:00:00' });
	return reposList.data.filter(repo => repo.fork == true && forks.data.some(fork => fork.id == repo.id));
};

export const forkEarthPort = async (session: Session | null) => {
	if (!session?.accessToken) return;
	const octokit = new Octokit({ auth: session?.accessToken, userAgent: localConfig.gitRepositoryUserAgent });
	const newRepo = await octokit.rest.repos.createFork({ owner: localConfig.gitRepositoryOwner, repo: localConfig.gitRepositoryName, name: localConfig.gitRepositoryName });
};

export const updateRepoConfig = async (session: Session | null, repo: Repository, config: ConfigInfo) => {
	if (!session?.accessToken) return;
	const octokit = new Octokit({ auth: session?.accessToken, userAgent: localConfig.gitRepositoryUserAgent });
	const { data } = await octokit.rest.repos.getContent({ owner: localConfig.gitRepositoryOwner, repo: localConfig.gitRepositoryName, path: 'constants/config.json', ref: localConfig.gitRepositoryBranch });
	const sha = data instanceof Array ? (data.length > 0 ? data[0].sha : undefined) : data.sha;
	const updatedRepo = await octokit.rest.repos.createOrUpdateFileContents({
		owner: repo.owner.login,
		repo: repo.name,
		path: 'constants/config.json',
		message: 'Update Config',
		content: utf16_to_b64(JSON.stringify(config))!,
		branch: localConfig.gitRepositoryBranch,
		sha: sha,
		committer: {
			name: localConfig.gitRepositoryUserAgent,
			email: session.user?.email ?? repo.owner.email ?? localConfig.gitRepositoryUserAgent,
		},
	});
	return updatedRepo;
};

export const updateRepoVariables = async (session: Session | null, repo: Repository) => {
	if (!session?.accessToken) return;
	const variables = getAllVariables();
	const octokit = new Octokit({ auth: session?.accessToken, userAgent: localConfig.gitRepositoryUserAgent });
	const { data } = await octokit.rest.repos.getContent({ owner: localConfig.gitRepositoryOwner, repo: localConfig.gitRepositoryName, path: 'styles/variables.scss', ref: localConfig.gitRepositoryBranch });
	const sha = data instanceof Array ? (data.length > 0 ? data[0].sha : undefined) : data.sha;
	const updatedRepo = await octokit.rest.repos.createOrUpdateFileContents({
		owner: repo.owner.login,
		repo: repo.name,
		path: 'styles/variables.scss',
		message: 'Update Styling Variables',
		content: utf16_to_b64(':root' + JSON.stringify(variables).replaceAll('"', ''))!,
		branch: localConfig.gitRepositoryBranch,
		sha: sha,
		committer: {
			name: localConfig.gitRepositoryUserAgent,
			email: session.user?.email ?? repo.owner.email ?? localConfig.gitRepositoryUserAgent,
		},
	});
	return updatedRepo;
};
