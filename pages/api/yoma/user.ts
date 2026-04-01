import { NextApiRequest, NextApiResponse } from 'next';

// TODO: Yoma API integration pending auth hub support
export default function handler(_req: NextApiRequest, res: NextApiResponse) {
  res.status(501).json({ message: 'Yoma API integration pending auth hub support' });
}
