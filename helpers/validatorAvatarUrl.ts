// Copied and used as-is from ixo mobile codebase:
// https://github.com/ixofoundation/ixo-Mobile-dev/blob/420290550d28994d1d3fd50e95824ba55c65ebcd/app/utils/validatorAvatarUrl.tsx
export const validatorAvatarUrl = async (identity: string) => {
	try {
		const kbFetch = (path: string) =>
			fetch('https://keybase.io/_/api/1.0' + path).then((resp) => (resp.ok ? resp.json() : Promise.reject(resp)));
		const {
			keys: [{ key_fingerprint }],
		} = await kbFetch('/key/fetch.json?pgp_key_ids=' + identity);
		const {
			them: [
				{
					pictures: {
						primary: { url },
					},
				},
			],
		} = await kbFetch('/user/lookup.json?key_fingerprint=' + key_fingerprint);

		return url;
	} catch (e) {
		console.error(e);
		return null;
	}
};
