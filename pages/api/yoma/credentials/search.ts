import { NextApiRequest, NextApiResponse } from 'next';
import { ssoConfig } from 'lib/sso/config';
import { cleanUrlString } from '@utils/url';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const auth = req.headers.authorization;
  if (!auth) {
    return res.status(401).json({ error: 'Missing authorization header' });
  }

  try {
    const response = await fetch(cleanUrlString(`${ssoConfig.apiBaseUrl}/v3/ssi/wallet/user/search`), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: auth,
      },
      body: JSON.stringify(req.body),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return res.status(response.status).json({ message: errorData.message || 'Failed to search credentials' });
    }

    const data = await response.json();
    res.json(data);
  } catch (error: any) {
    console.error('Yoma credentials search proxy error:', error);
    res.status(500).json({ message: error.message || 'Failed to search credentials' });
  }
}
