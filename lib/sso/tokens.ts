import { createRemoteJWKSet, jwtVerify, JWTPayload } from 'jose';
import { ssoConfig } from './config';
import { cleanUrlString } from '@utils/url';

export interface SSOTokens {
  access_token: string;
  id_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in: number;
}

export interface SSOUserInfo {
  email: string | null;
  name: string | null;
  picture: string | null;
  sub: string;
}

export async function exchangeCodeForTokens(code: string, codeVerifier: string): Promise<SSOTokens> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: ssoConfig.clientId,
    redirect_uri: ssoConfig.redirectUri,
    code,
    code_verifier: codeVerifier,
  });

  const response = await fetch(cleanUrlString(ssoConfig.tokenEndpoint), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token exchange failed: ${error}`);
  }

  return response.json();
}

const jwks = createRemoteJWKSet(new URL(ssoConfig.jwksUri));

export async function validateIdToken(idToken: string): Promise<SSOUserInfo> {
  const { payload } = await jwtVerify(idToken, jwks, {
    issuer: ssoConfig.issuer,
    audience: ssoConfig.clientId,
  });

  return {
    email: (payload as JWTPayload & { email?: string }).email ?? null,
    name: (payload as JWTPayload & { name?: string }).name ?? null,
    picture: (payload as JWTPayload & { picture?: string }).picture ?? null,
    sub: payload.sub!,
  };
}
