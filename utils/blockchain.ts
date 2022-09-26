// import { BLOCKCHAIN_REST_URL } from '@constants/chains';
// import axios from 'axios';

// const blockChainFetchAPI = axios.create({
// 	baseURL: BLOCKCHAIN_REST_URL,
// 	headers: { Accept: 'application/json' },
// });

// export async function bcFetchPost(url: string, { ...options }, urlParams?: any, fullResponse = false): Promise<any> {
// 	const urlParamsStr = new URLSearchParams(urlParams).toString();
// 	const modifiedUrl = blockChainFetchAPI.getUri + url + (urlParamsStr ? '?' + urlParamsStr : '');
// 	// used for debug
// 	// const rawBody = options ? options.body : undefined;

// 	const fetchOps = {
// 		...options,
// 		body: options?.body && sortedJsonStringify(options?.body),
// 		headers: {
// 			Accept: 'application/json',
// 			'Content-Type': 'application/json',
// 			...options?.headers,
// 		},
// 	};

// 	const resp = await blockChainFetchAPI.post(modifiedUrl, fetchOps.body);

// 	if (!resp.headers) {
// 		throw new Error('Response is undefined');
// 	}
// 	const body = resp.data;
// 	return Promise[resp.status ? 'resolve' : 'reject'](
// 		fullResponse
// 			? {
// 					status: resp.status,
// 					headers: resp.headers,
// 					body,
// 			  }
// 			: body,
// 	);
// }

// export async function bcFetchGet(url: string, urlParams?: any, fullResponse = false): Promise<any> {
// 	const urlParamsStr = new URLSearchParams(urlParams).toString();
// 	const modifiedUrl = blockChainFetchAPI.getUri + url + (urlParamsStr ? '?' + urlParamsStr : '');
// 	// used for debug
// 	// const rawBody = options ? options.body : undefined;
// 	console.log('[BCFETCH]', url, urlParams);
// 	const resp = await blockChainFetchAPI.get(modifiedUrl);

// 	if (!resp.headers) {
// 		throw new Error('Response is undefined');
// 	}
// 	const body = resp.data;
// 	return Promise[resp.status ? 'resolve' : 'reject'](
// 		fullResponse
// 			? {
// 					status: resp.status,
// 					headers: resp.headers,
// 					body,
// 			  }
// 			: body,
// 	);
// }
