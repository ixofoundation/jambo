import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
	if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	const { authnResult, address } = req.body;

	try {
		// Get encrypted mnemonic from Matrix room
		const response = await fetch(`${process.env.NEXT_PUBLIC_MATRIX_ROOM_BOT_URL}/room/mnemonic`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				roomAlias: `did-ixo-${address}`,
				authnResult,
				address,
			}),
		});
		console.log('response', response.ok, response.status, await response.json());
		if (!response.ok) {
			const message = await response
				.json()
				.then((res) => res?.message ?? 'Failed to fetch encrypted mnemonic')
				.catch(() => 'Failed to fetch encrypted mnemonic');
			res.status(response.status).json({
				error: message,
			});
			return;
			// throw new Error('Failed to fetch encrypted mnemonic');
		}

		const { encryptedMnemonic, roomId } = await response.json();
		res.json({ encryptedMnemonic, roomId, address });
	} catch (error: any) {
		console.error(error);
		res.status(500).json({ error: 'Verification failed: ' + error.message });
	}
}
