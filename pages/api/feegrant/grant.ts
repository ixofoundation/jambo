import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
	if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	const { address } = req.body;

	try {
		// Get encrypted mnemonic from Matrix room
		const response = await fetch(`${process.env.FEEGRANT_URL}/feegrant/${address}`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: process.env.FEEGRANT_AUTH as string,
			},
			body: JSON.stringify({}),
		});

		if (!response.ok) {
			const error = await response.json().catch(() => undefined);
			throw new Error(`API::Failed to grant feegrant - ${JSON.stringify(error)}`);
		}

		const data = await response.json();

		if (data.code !== 0) {
			throw new Error(`API::Feegrant failed with code ${data.code} - ${JSON.stringify(data)}`);
		}

		res.json({ data });
	} catch (error: any) {
		console.error(error);
		res.status(500).json({ error: error.message ?? 'Unknown error' });
	}
}
