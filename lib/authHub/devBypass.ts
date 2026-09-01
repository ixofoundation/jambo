import { DEV_BYPASS } from './config';
import type { AuthHubSessionData } from './redirect';

export function isDevBypass(): boolean {
  return DEV_BYPASS;
}

/**
 * Returns mock session data for local development without a running auth hub.
 * Uses a deterministic test mnemonic — never use in production.
 */
export function getDevBypassSession(): AuthHubSessionData {
  return {
    address: 'ixo1devbypassaddress000000000000000000000',
    // Must match the matrixclient-sdk DID shape (did:ixo:<id>, no extra
    // segment) or every bid/claim-bot call fails client-side with
    // "Invalid DID" under the bypass.
    did: 'did:ixo:devbypass000000000000000000000',
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
