import { NextApiRequest, NextApiResponse } from 'next';
import { cleanUrlString } from '@utils/url';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const response = await fetch(cleanUrlString(`${process.env.NEXT_PUBLIC_MATRIX_ROOM_BOT_URL}/user/create`), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(req.body),
    });

    if (!response.ok) {
      let message = `Upstream ${response.status}: ${response.statusText}`;
      try {
        const errorData = await response.json();
        if (errorData.error || errorData.message) {
          message = `Upstream ${response.status}: ${errorData.error || errorData.message}`;
        }
      } catch {
        // response body wasn't JSON — keep the status text
      }
      return res.status(response.status).json({ error: message });
    }

    const data = await response.json();
    res.json(data);
  } catch (error: any) {
    console.error('User creation error:', error);
    res.status(500).json({ error: error.message || 'Failed to create user account' });
  }
}
