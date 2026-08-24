import { DirectSecp256k1HdWallet } from '@cosmjs/proto-signing';

import { DEV_BYPASS } from './config';
import type { AuthHubSessionData } from './redirect';

export function isDevBypass(): boolean {
  return DEV_BYPASS;
}

/**
 * Session data for local development without a running auth hub — a quick
 * login, nothing more. The env carries only the secrets a real session holds
 * (the three mnemonics; the vault PIN sits beside them for the human).
 * Everything else is derived the way the real flow derives it: address from
 * the session mnemonic, DID from the address, Matrix user id from the
 * configured homeserver, and the DID room via the public room-alias lookup.
 * Name and photo come from the Matrix profile alone — so every screen,
 * including failure states, looks exactly as it would for a real user.
 *
 * Without the env vars it falls back to an offline mock whose Matrix login
 * fails, exercising the app's localStorage-only fallback mode. Never use in
 * production.
 */
export async function getDevBypassSession(): Promise<AuthHubSessionData> {
  const sessionMnemonic = process.env.NEXT_PUBLIC_DEV_BYPASS_MNEMONIC;
  const matrixMnemonic = process.env.NEXT_PUBLIC_DEV_BYPASS_MATRIX_MNEMONIC;
  const edSigningMnemonic = process.env.NEXT_PUBLIC_DEV_BYPASS_ED_MNEMONIC;
  const homeserverUrl = process.env.NEXT_PUBLIC_MATRIX_HOMESERVER_URL;

  if (sessionMnemonic && matrixMnemonic && edSigningMnemonic && homeserverUrl) {
    const wallet = await DirectSecp256k1HdWallet.fromMnemonic(sessionMnemonic, { prefix: 'ixo' });
    const [{ address }] = await wallet.getAccounts();
    const domain = new URL(homeserverUrl).host;

    // Resolve the user's DID room like any Matrix client: via the public
    // room-alias directory. Best-effort — when it fails, features needing the
    // room degrade exactly as they would for a real user.
    let matrixRoomId = '';
    try {
      const alias = encodeURIComponent(`#did-ixo-${address}:${domain}`);
      const res = await fetch(`${homeserverUrl.replace(/\/$/, '')}/_matrix/client/v3/directory/room/${alias}`);
      if (res.ok) matrixRoomId = (await res.json())?.room_id ?? '';
    } catch {
      // left empty — surfaced by the same paths a real user would hit
    }

    return {
      address,
      did: `did:ixo:${address}`,
      displayName: null, // provided by the Matrix profile, like a real login
      sessionMnemonic,
      sessionAuthenticatorId: '1',
      edSigningMnemonic,
      matrixMnemonic,
      matrixUserId: `@did-ixo-${address}:${domain}`,
      matrixRoomId,
    };
  }

  return {
    address: 'ixo1devbypassaddress000000000000000000000',
    did: 'did:ixo:entity:devbypass000000000000000000000',
    displayName: 'Dev User',
    email: 'devbypass@example.com',
    sessionMnemonic:
      'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
    sessionAuthenticatorId: '1',
    edSigningMnemonic:
      'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
    matrixMnemonic:
      'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
    matrixUserId: '@ixo1devbypassaddress:devmx.ixo.earth',
    matrixRoomId: '!devbypassroom:devmx.ixo.earth',
  };
}
