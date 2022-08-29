import { Octokit } from '@octokit/rest';
import { GetResponseDataTypeFromEndpointMethod } from '@octokit/types';
import { createContext, useState, HTMLAttributes } from 'react';
import { ArrayElement } from 'types/general';

const octokit = new Octokit();
export type GetContentResponseDataType = GetResponseDataTypeFromEndpointMethod<typeof octokit.rest.repos.getContent>;
export type ListRepositoriesResponseDataType = GetResponseDataTypeFromEndpointMethod<typeof octokit.rest.repos.listForAuthenticatedUser>;
export type Repository = ArrayElement<ListRepositoriesResponseDataType>;

export const ReposContext = createContext({ repositories: [] as ListRepositoriesResponseDataType, updateRepositories: (clear: boolean, repos: ListRepositoriesResponseDataType) => {} });

export const ReposProvider = ({ children }: HTMLAttributes<HTMLDivElement>) => {
	const [repositories, setRepositories] = useState<ListRepositoriesResponseDataType>([]);

	const updateRepositories = (clear: boolean, repos: ListRepositoriesResponseDataType) => {
		setRepositories(currentRepos => (clear ? repos : [...currentRepos, ...repos]));
	};

	const value = { repositories, updateRepositories };
	return <ReposContext.Provider value={value}>{children}</ReposContext.Provider>;
};
