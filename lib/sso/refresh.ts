import { ssoConfig } from './config';
import { secureSave, secureLoad, secureReset } from '@utils/storage';
import { cleanUrlString } from '@utils/url';
import authConstants from '@constants/auth';

const EXPIRY_BUFFER_MS = 30_000;
let refreshPromise: Promise<string | null> | null = null;

export async function getValidAccessToken(): Promise<string | null> {
  const accessToken = secureLoad(authConstants.yomaKey.ACCESS_TOKEN);
  if (!accessToken) return null;

  const expiresAt = Number(secureLoad(authConstants.yomaKey.EXPIRES_AT));
  if (expiresAt && Date.now() < expiresAt - EXPIRY_BUFFER_MS) {
    return accessToken;
  }

  const refreshToken = secureLoad(authConstants.yomaKey.REFRESH_TOKEN);
  if (!refreshToken) {
    clearYomaTokens();
    return null;
  }

  if (refreshPromise) return refreshPromise;

  refreshPromise = performRefresh(refreshToken);
  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

async function performRefresh(refreshToken: string): Promise<string | null> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: ssoConfig.clientId,
    refresh_token: refreshToken,
  });

  try {
    const response = await fetch(cleanUrlString(ssoConfig.tokenEndpoint), {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!response.ok) {
      console.error('[SSO] Token refresh failed:', await response.text());
      clearYomaTokens();
      return null;
    }

    const data = await response.json();
    const newExpiresAt = Date.now() + data.expires_in * 1000;

    secureSave(authConstants.yomaKey.ACCESS_TOKEN, data.access_token);
    if (data.refresh_token) secureSave(authConstants.yomaKey.REFRESH_TOKEN, data.refresh_token);
    secureSave(authConstants.yomaKey.EXPIRES_AT, String(newExpiresAt));

    return data.access_token;
  } catch (err) {
    console.error('[SSO] Token refresh error:', err);
    clearYomaTokens();
    return null;
  }
}

function clearYomaTokens() {
  secureReset(authConstants.yomaKey.ACCESS_TOKEN);
  secureReset(authConstants.yomaKey.REFRESH_TOKEN);
  secureReset(authConstants.yomaKey.EXPIRES_AT);
}
