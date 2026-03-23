import { NextApiRequest, NextApiResponse } from 'next';
import { cleanUrlString } from '@utils/url';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { address } = req.body;
  if (!address || typeof address !== 'string') {
    return res.status(400).json({ error: 'address is required' });
  }

  const feegrantUrl = process.env.NEXT_PUBLIC_FEEGRANT_URL;
  const apiKey = process.env.FEEGRANT_API_KEY;

  if (!feegrantUrl || !apiKey) {
    return res.status(500).json({ error: 'Feegrant service not configured' });
  }

  try {
    const response = await fetch(cleanUrlString(`${feegrantUrl}/feegrant/${address}`), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return res.status(response.status).json({ message: errorData.message || 'Failed to grant feegrant' });
    }

    const data = await response.json();
    res.json(data);
  } catch (error: any) {
    console.error('Feegrant grant error:', error);
    res.status(500).json({ message: error.message || 'Failed to grant feegrant' });
  }
}
