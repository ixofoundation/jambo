/**
 * What the old KYC proxy (pages/api/kyc/[...path].ts) still forwards to
 * ixo-kyc-server. Nobody can start an old identity check any more
 * (docs/self-kyc-plan.md 4.6), so the proxy only lets through the calls a
 * person midway through one needs to finish it (utils/kycServer.ts):
 *
 * - GET   tokens/:did/:protocolId              reopen the document-scan step
 * - GET   kycaml/:did/:protocolId/status       the check's status
 * - GET   kycaml/:did/:protocolId/credential   the issued credential
 * - GET   kycaml/:did/:protocolId              the credential data (`?dump=true`)
 * - PATCH kycaml/:did/:protocolId              mark the check complete (saved)
 * - GET   .well-known/did.json                 the server's DID: every signed call
 *                                              above is addressed to it (utils/ucan.ts)
 */
export function isAllowedLegacyKycRequest(method: string | undefined, pathParts: readonly string[]): boolean {
  if (pathParts.some((part) => !part || part === '.' || part === '..' || part.includes('/'))) return false;
  const [root, , , leaf] = pathParts;
  if (method === 'GET') {
    if (root === '.well-known') return pathParts.length === 2 && pathParts[1] === 'did.json';
    if (root === 'tokens') return pathParts.length === 3;
    if (root !== 'kycaml') return false;
    return pathParts.length === 3 || (pathParts.length === 4 && (leaf === 'status' || leaf === 'credential'));
  }
  if (method === 'PATCH') return root === 'kycaml' && pathParts.length === 3;
  return false;
}

/** The only change the app still makes to an old check: marking it complete once the credential is saved. */
export function isAllowedLegacyKycPatchBody(body: string | undefined): boolean {
  if (!body) return false;
  try {
    const parsed: unknown = JSON.parse(body);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return false;
    const keys = Object.keys(parsed);
    return keys.length === 1 && (parsed as { status?: unknown }).status === 'complete';
  } catch {
    return false;
  }
}
