import type { NextApiRequest, NextApiResponse } from 'next';

// Same shape as the jambo-worker proxy (pages/api/yomaWorker) — forwards to
// the Yoma pull-synchronisation worker, which hosts the DID↔Yoma link
// endpoints and its did:web document.
const YOMA_SYNC_WORKER_URL = (process.env.NEXT_PUBLIC_YOMA_SYNC_WORKER_URL || '').trim().replace(/\/+$/, '');

export const config = {
  api: { bodyParser: false },
};

const HOP_BY_HOP_REQ = new Set(['host', 'connection', 'content-length', 'accept-encoding']);
const HOP_BY_HOP_RES = new Set(['transfer-encoding', 'connection', 'content-encoding', 'content-length']);

async function readBody(req: NextApiRequest): Promise<Buffer | undefined> {
  if (req.method === 'GET' || req.method === 'HEAD') return undefined;
  const chunks: Uint8Array[] = [];
  // The cast sidesteps a Buffer/Uint8Array generics mismatch in newer
  // @types/node — at runtime these are plain Buffers.
  for await (const chunk of req) chunks.push(new Uint8Array(Buffer.from(chunk)));
  return chunks.length ? Buffer.concat(chunks) : undefined;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!YOMA_SYNC_WORKER_URL) {
    return res.status(500).json({ error: 'Yoma sync worker not configured (NEXT_PUBLIC_YOMA_SYNC_WORKER_URL missing)' });
  }

  const pathParts = (req.query.path as string[] | undefined) ?? [];
  const qs = req.url?.includes('?') ? '?' + req.url.split('?')[1] : '';
  // Next decodes the catch-all segments; re-encode so a segment containing an
  // encoded "/" (or similar) can't address a different upstream route.
  const targetUrl = `${YOMA_SYNC_WORKER_URL}/${pathParts.map(encodeURIComponent).join('/')}${qs}`;

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
    console.error('[yomaSync-proxy] error proxying', req.method, targetUrl, '-', message);
    res.status(502).json({ error: `Yoma sync worker proxy error: ${message}` });
  }
}
