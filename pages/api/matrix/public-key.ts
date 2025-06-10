import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_MATRIX_ROOM_BOT_URL}/public-key`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch public key for encryption');
    }

    const data = await response.json();
    res.json(data);
  } catch (error: any) {
    console.error('Public key fetch error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch public key' });
  }
}
