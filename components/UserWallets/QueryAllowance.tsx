import { QUERY_CLIENT } from 'types/query';

export const queryAllowances = async (queryClient: QUERY_CLIENT, grantee: string) => { 
	try {
		const res = await queryClient.cosmos.feegrant.v1beta1.allowances({ grantee });
		return res;
	} catch (error) {
		console.error('queryAllowances::', error);
		return undefined;
	}
};