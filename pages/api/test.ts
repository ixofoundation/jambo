// Netlify cloud function, consider using Netlify Edge Functions for quicker response times.
// Or Netlify Background Functions if have function that will take between 10s and 15min,

import type { NextApiRequest, NextApiResponse } from 'next';

type ResponseData = {
	message: string;
};

export default function handler(req: NextApiRequest, res: NextApiResponse<ResponseData>) {
	res.status(200).json({ message: 'Test' });
}
