import { NextApiRequest, NextApiResponse } from 'next';
import { cleanUrlString } from '@utils/url';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { authnResult, address } = req.body;
  console.log({
    address,
    authnResult,
  });

  try {
    // Get encrypted mnemonic from Matrix room
    const response = await fetch(cleanUrlString(`${process.env.NEXT_PUBLIC_MATRIX_ROOM_BOT_URL}/room/mnemonic`), {
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

    const { encryptedMnemonic, roomId } = await response.json();
    res.json({ encryptedMnemonic, roomId, address });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: 'Verification failed: ' + error.message });
  }
}
