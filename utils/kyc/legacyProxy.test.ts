import { describe, expect, it } from 'vitest';

import { isAllowedLegacyKycPatchBody, isAllowedLegacyKycRequest } from './legacyProxy';

const DID = 'did:ixo:ixo190vqdjtlpcq27xslcveglfmr4ynfwg7glwx95q';
const PROTOCOL = 'did:ixo:entity:abc';

describe('isAllowedLegacyKycRequest', () => {
  it('lets through the calls that finish an old check', () => {
    expect(isAllowedLegacyKycRequest('GET', ['tokens', DID, PROTOCOL])).toBe(true);
    expect(isAllowedLegacyKycRequest('GET', ['kycaml', DID, PROTOCOL, 'status'])).toBe(true);
    expect(isAllowedLegacyKycRequest('GET', ['kycaml', DID, PROTOCOL, 'credential'])).toBe(true);
    expect(isAllowedLegacyKycRequest('GET', ['kycaml', DID, PROTOCOL])).toBe(true);
    expect(isAllowedLegacyKycRequest('PATCH', ['kycaml', DID, PROTOCOL])).toBe(true);
  });

  it('lets through the server DID document, which the signed calls need', () => {
    expect(isAllowedLegacyKycRequest('GET', ['.well-known', 'did.json'])).toBe(true);
    expect(isAllowedLegacyKycRequest('PATCH', ['.well-known', 'did.json'])).toBe(false);
    expect(isAllowedLegacyKycRequest('POST', ['.well-known', 'did.json'])).toBe(false);
    expect(isAllowedLegacyKycRequest('GET', ['.well-known'])).toBe(false);
    expect(isAllowedLegacyKycRequest('GET', ['.well-known', 'did.json', 'x'])).toBe(false);
    expect(isAllowedLegacyKycRequest('GET', ['.well-known', 'openid-configuration'])).toBe(false);
    expect(isAllowedLegacyKycRequest('GET', ['.well-known', DID, PROTOCOL])).toBe(false);
  });

  it('refuses every method that could start or change a check', () => {
    for (const method of ['POST', 'PUT', 'DELETE', 'HEAD', 'OPTIONS', 'get', undefined]) {
      expect(isAllowedLegacyKycRequest(method, ['kycaml', DID, PROTOCOL])).toBe(false);
      expect(isAllowedLegacyKycRequest(method, ['kycaml'])).toBe(false);
    }
    expect(isAllowedLegacyKycRequest('PATCH', ['kycaml', DID, PROTOCOL, 'status'])).toBe(false);
    expect(isAllowedLegacyKycRequest('PATCH', ['tokens', DID, PROTOCOL])).toBe(false);
  });

  it('refuses any other path', () => {
    expect(isAllowedLegacyKycRequest('GET', [])).toBe(false);
    expect(isAllowedLegacyKycRequest('GET', ['kycaml'])).toBe(false);
    expect(isAllowedLegacyKycRequest('GET', ['kycaml', DID])).toBe(false);
    expect(isAllowedLegacyKycRequest('GET', ['kycaml', DID, PROTOCOL, 'webhook'])).toBe(false);
    expect(isAllowedLegacyKycRequest('GET', ['kycaml', DID, PROTOCOL, 'status', 'x'])).toBe(false);
    expect(isAllowedLegacyKycRequest('GET', ['tokens', DID])).toBe(false);
    expect(isAllowedLegacyKycRequest('GET', ['admin', DID, PROTOCOL])).toBe(false);
    expect(isAllowedLegacyKycRequest('GET', ['kycaml', '..', 'admin'])).toBe(false);
    expect(isAllowedLegacyKycRequest('GET', ['kycaml', DID, 'a/b'])).toBe(false);
    expect(isAllowedLegacyKycRequest('GET', ['kycaml', DID, ''])).toBe(false);
  });
});

describe('isAllowedLegacyKycPatchBody', () => {
  it('accepts only "mark complete"', () => {
    expect(isAllowedLegacyKycPatchBody('{"status":"complete"}')).toBe(true);
    expect(isAllowedLegacyKycPatchBody('{"status":"verify"}')).toBe(false);
    expect(isAllowedLegacyKycPatchBody('{"status":"complete","reset":true}')).toBe(false);
    expect(isAllowedLegacyKycPatchBody('["complete"]')).toBe(false);
    expect(isAllowedLegacyKycPatchBody('not json')).toBe(false);
    expect(isAllowedLegacyKycPatchBody('')).toBe(false);
    expect(isAllowedLegacyKycPatchBody(undefined)).toBe(false);
  });
});
