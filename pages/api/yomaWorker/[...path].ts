import type { NextApiRequest, NextApiResponse } from 'next';

const JAMBO_WORKER_URL = (process.env.NEXT_PUBLIC_JAMBO_WORKER_URL || '').trim().replace(/\/+$/, '');

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
  if (!JAMBO_WORKER_URL) {
    return res.status(500).json({ error: 'Jambo worker not configured (NEXT_PUBLIC_JAMBO_WORKER_URL missing)' });
  }

  const pathParts = (req.query.path as string[] | undefined) ?? [];
  const qs = req.url?.includes('?') ? '?' + req.url.split('?')[1] : '';
  // Next decodes the catch-all segments; re-encode so a segment containing an
  // encoded "/" (or similar) can't address a different upstream route.
  const targetUrl = `${JAMBO_WORKER_URL}/${pathParts.map(encodeURIComponent).join('/')}${qs}`;

  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (!v) continue;
    if (HOP_BY_HOP_REQ.has(k.toLowerCase())) continue;
    headers.set(k, Array.isArray(v) ? v.join(', ') : v);
  }

  try {
    const body = await readBody(req);
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
    console.error('[yomaWorker-proxy] error proxying', req.method, targetUrl, '-', message);
    res.status(502).json({ error: `Jambo worker proxy error: ${message}` });
  }
}
