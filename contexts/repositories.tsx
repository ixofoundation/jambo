import { Octokit } from '@octokit/rest';
import { GetResponseDataTypeFromEndpointMethod } from '@octokit/types';
import { createContext, useState, HTMLAttributes } from 'react';

const octokit = new Octokit();
type ListRepositoriesResponseDataType = GetResponseDataTypeFromEndpointMethod<typeof octokit.rest.repos.listForAuthenticatedUser>;

export const ReposContext = createContext({ repositories: [] as ListRepositoriesResponseDataType, updateRepositories: (clear: boolean, repos: ListRepositoriesResponseDataType) => {} });

export const ReposProvider = ({ children }: HTMLAttributes<HTMLDivElement>) => {
	const [repositories, setRepositories] = useState<ListRepositoriesResponseDataType>([]);

	const updateRepositories = (clear: boolean, repos: ListRepositoriesResponseDataType) => {
		setRepositories(clear ? repos : [...repositories, ...repos]);
	};
	console.log({ repositories });

	const value = { repositories, updateRepositories };
	return <ReposContext.Provider value={value}>{children}</ReposContext.Provider>;
};
