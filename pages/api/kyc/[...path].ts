import type { NextApiRequest, NextApiResponse } from 'next';

import { isAllowedLegacyKycPatchBody, isAllowedLegacyKycRequest } from '@utils/kyc/legacyProxy';

const KYC_SERVER_URL = (process.env.KYC_SERVER_URL || '').trim().replace(/\/$/, '');
const ALLOW_INSECURE_TLS = process.env.KYC_PROXY_INSECURE === 'true';

if (ALLOW_INSECURE_TLS && process.env.NODE_ENV !== 'production') {
  // Dev-only escape hatch for self-signed / untrusted KYC server certs.
  // Prefer pinning a real cert in production.
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

export const config = {
  api: { bodyParser: false },
};

const HOP_BY_HOP_REQ = new Set(['host', 'connection', 'content-length', 'accept-encoding']);
const HOP_BY_HOP_RES = new Set(['transfer-encoding', 'connection', 'content-encoding', 'content-length']);

async function readBody(req: NextApiRequest): Promise<Buffer | undefined> {
  if (req.method === 'GET' || req.method === 'HEAD') return undefined;
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  return chunks.length ? Buffer.concat(chunks) : undefined;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!KYC_SERVER_URL) {
    return res.status(500).json({ error: 'KYC server not configured (KYC_SERVER_URL missing)' });
  }

  const pathParts = (req.query.path as string[] | undefined) ?? [];
  // The old check can only be finished, never started: forward nothing else.
  if (!isAllowedLegacyKycRequest(req.method, pathParts)) {
    res.setHeader('Allow', 'GET, PATCH');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const qs = req.url?.includes('?') ? '?' + req.url.split('?')[1] : '';
  const targetUrl = `${KYC_SERVER_URL}/${pathParts.join('/')}${qs}`;

  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (!v) continue;
    if (HOP_BY_HOP_REQ.has(k.toLowerCase())) continue;
    headers.set(k, Array.isArray(v) ? v.join(', ') : v);
  }

  try {
    const body = await readBody(req);
    if (req.method === 'PATCH' && !isAllowedLegacyKycPatchBody(body?.toString('utf8'))) {
      return res.status(405).json({ error: 'Method not allowed' });
    }
    const upstream = await fetch(targetUrl, {
      method: req.method,
      headers,
      body: body as any,
    });

    res.status(upstream.status);
    upstream.headers.forEach((v, k) => {
      if (HOP_BY_HOP_RES.has(k.toLowerCase())) return;
      res.setHeader(k, v);
    });

    const buf = Buffer.from(await upstream.arrayBuffer());
    res.end(buf);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[kyc-proxy] error proxying', req.method, targetUrl, '-', message);
    res.status(502).json({ error: `KYC proxy error: ${message}` });
  }
}
