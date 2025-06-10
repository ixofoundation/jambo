import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_EMAIL_OTP_WORKER_URL}/request-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(req.body),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to request OTP');
    }

    const data = await response.json();
    res.json(data);
  } catch (error: any) {
    console.error('Email OTP request error:', error);
    res.status(500).json({ error: error.message || 'Failed to request OTP' });
  }
}
