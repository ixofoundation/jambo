import { CHAIN_NETWORK_TYPE, DefaultChainNetwork } from './common';

/**
 * IXO Virtual Filesystem (VFS) — per-network worker endpoints. Claim evidence (survey
 * attachments, photos, video) is stored on the VFS "claims lane" instead of Matrix media; see
 * lib/vfs/claimMedia.ts. Hosts mirror the worker's pinned SERVICE_DID_HOST per env.
 */
export const VfsBaseUrls: { [network in CHAIN_NETWORK_TYPE]: string } = {
  mainnet: 'https://vfs.ixo.earth',
  testnet: 'https://testnet.vfs.ixo.earth',
  devnet: 'https://devnet.vfs.ixo.earth',
  local: 'http://localhost:8795',
};

/** Override with NEXT_PUBLIC_VFS_URL for local dev against `wrangler dev`. */
export const VFS_BASE_URL = process.env.NEXT_PUBLIC_VFS_URL || VfsBaseUrls[DefaultChainNetwork];

/** The UCAN resource prefix scoping the filesystem (matches the worker's FS_RESOURCE_PREFIX). */
export const VFS_RESOURCE = 'ixo:filesystem';
