export type EntityService = {
  id?: string;
  type?: string;
  serviceEndpoint?: string;
};

export function cleanUrlString(url: string): string {
  // Remove line breakers such as \n and any other whitespace characters
  let cleanedUrl = url.replace(/[\n\r\s]/g, '');
  // Regular expression to match duplicate slashes except for the first one after "https://" or "http://"
  const regex = /(https?:\/\/|[^:])\/\//g;
  // Replace duplicate slashes with a single slash, excluding the first one after "https://" or "http://"
  cleanedUrl = cleanedUrl.replace(regex, (match, p1, offset, string) => {
    // If match starts with http: or https:, keep it as it is.
    if (p1 === 'http://' || p1 === 'https://') {
      return match;
    } else {
      // Otherwise, replace the extra slashes with a single slash
      return p1 + '/';
    }
  });
  return cleanedUrl;
}

export function convertIpfsToWeb3StorageUrl(url: string) {
  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.hostname === 'cf-ipfs.com' || parsedUrl.hostname?.endsWith('.ipfs.cf-ipfs.com')) {
      const cid =
        parsedUrl.hostname === 'cf-ipfs.com'
          ? parsedUrl.pathname.split('/')[parsedUrl.pathname.split('/').length - 1]
          : parsedUrl.hostname.split('.')[0];
      parsedUrl.hostname = `${cid}.ipfs.w3s.link`;
      parsedUrl.pathname = '/';
      const web3StorageUrl = parsedUrl.toString();
      return web3StorageUrl;
    } else if (parsedUrl.hostname === 'ipfs.io' && parsedUrl.pathname.startsWith('/ipfs/')) {
      const splitPath = parsedUrl.pathname.split('/');
      const cid = splitPath[splitPath.length - 1];
      parsedUrl.hostname = `${cid}.ipfs.w3s.link`;
      parsedUrl.pathname = '/';
      const web3StorageUrl = parsedUrl.toString();
      return web3StorageUrl;
    } else if (parsedUrl.hostname === 'ipfs.gateway.ixo.world' && !parsedUrl.pathname.startsWith('/ipfs/')) {
      const cid = parsedUrl.pathname.split('/')[parsedUrl.pathname.split('/').length - 1];
      parsedUrl.pathname = `/ipfs/${cid}`;
      const web3StorageUrl = parsedUrl.toString();
      return web3StorageUrl;
    }
  } catch (error) {
    console.error('Invalid URL:', url);
  }
  return url;
}

export function getServiceEndpoint(url = '', services: EntityService[] = []) {
  // if url includes :// it means it already an https link most probably
  if (url.includes('://')) {
    return convertIpfsToWeb3StorageUrl(url);
  }
  const pos = url.indexOf(':');
  if (pos === -1) {
    return convertIpfsToWeb3StorageUrl(url);
  }
  const service = url.substring(0, pos);
  const endUrl = url.substring(pos + 1);
  let serviceEndpoint = services.find((s: any) => {
    const posHash = s.id.indexOf('#');
    const id = s.id.substring(posHash + 1);
    return id === service;
  })?.serviceEndpoint;
  if (!serviceEndpoint?.endsWith('/')) {
    serviceEndpoint = serviceEndpoint + '/';
  }
  if (!serviceEndpoint) {
    return convertIpfsToWeb3StorageUrl(url);
  }
  const endpoint = convertIpfsToWeb3StorageUrl(serviceEndpoint + endUrl);
  return cleanUrlString(endpoint);
}

/**
 * Check the Redux store for a cached template at the given resolved URL.
 * Since CID-based URLs are content-addressed, if the URL hasn't changed
 * the content is guaranteed to be the same — no need to re-fetch.
 */
export function getCachedTemplate(
  protocolDid: string,
  type: 'vct' | 'bco' | 'bev',
  resolvedUrl: string,
): any | undefined {
  // Lazy import to avoid circular dependency at module load time
  const { store } = require('@store/index');
  const state = store.getState();
  const cachedUrl = state.protocols?.resolvedUrls?.[protocolDid]?.[type];
  if (cachedUrl === resolvedUrl) {
    const templates =
      type === 'vct'
        ? state.protocols.vctTemplates
        : type === 'bco'
          ? state.protocols.bcoTemplates
          : state.protocols?.bevTemplates;
    return templates?.[protocolDid];
  }
  return undefined;
}

export const getAdditionalInfo = async (url: string, tag?: string) => {
  const cleanUrl = cleanUrlString(url);
  const res = await fetch(cleanUrl, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) {
    console.error(res);
    throw new Error(res.statusText || `Request failed with status ${res.status}`);
  }
  const data = await res.json();
  return data;
};
