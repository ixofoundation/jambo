/**
 * Which DID may a service at a URL taken from data be addressed as?
 *
 * A UCAN's audience comes from the service's own document, but the URL is not ours, so that
 * document proves nothing unless it names the URL's own host. A service at `host` must present
 * `did:web:<host>`: a fake host then cannot obtain a token for any service but itself, however
 * it answers. No allowlist: any host that publishes its own did:web qualifies.
 */

const DID_DOCUMENT_TIMEOUT_MS = 5000;

/** Hosts that presented their own did:web this session, by origin. Read back through the same check. */
const serviceDids = new Map<string, string>();
const pendingResolutions = new Map<string, Promise<string | null>>();

/** The did:web a service at this URL must present: `did:web:<host>`, with a port's `:` encoded. */
export function didWebForUrl(serviceUrl: string): string {
  return `did:web:${new URL(serviceUrl).host.replace(':', '%3A')}`;
}

/** A UCAN audience counts only when it names that service's own host. */
export function isBoundServiceDid(serviceUrl: string, did: unknown): did is string {
  return typeof did === 'string' && did === didWebForUrl(serviceUrl);
}

export function getCachedServiceDid(origin: string): string | undefined {
  return serviceDids.get(origin);
}

export function setCachedServiceDid(origin: string, did: string): void {
  serviceDids.set(origin, did);
}

async function fetchBoundServiceDid(origin: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DID_DOCUMENT_TIMEOUT_MS);
  try {
    const res = await fetch(`${origin}/.well-known/did.json`, {
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      redirect: 'error',
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const did = ((await res.json()) as { id?: unknown } | null)?.id;
    if (!isBoundServiceDid(origin, did)) return null;
    serviceDids.set(origin, did);
    return did;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The DID of the service at `serviceUrl`, or null when it has none we can use: not https, no
 * readable did.json, or a document naming anything but this host. Never throws.
 */
export async function resolveBoundServiceDid(serviceUrl: string): Promise<string | null> {
  let origin: string;
  try {
    const url = new URL(serviceUrl);
    if (url.protocol !== 'https:') return null;
    origin = url.origin;
  } catch {
    return null;
  }

  const cached = serviceDids.get(origin);
  if (isBoundServiceDid(origin, cached)) return cached;
  serviceDids.delete(origin);

  let pending = pendingResolutions.get(origin);
  if (!pending) {
    pending = fetchBoundServiceDid(origin)
      .catch(() => null)
      .finally(() => pendingResolutions.delete(origin));
    pendingResolutions.set(origin, pending);
  }
  return pending;
}
