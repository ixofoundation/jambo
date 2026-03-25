import { ssoConfig } from './config';
import { getValidAccessToken } from './refresh';

async function yomaFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = await getValidAccessToken();
  if (!token) throw new Error('Yoma SSO session expired');

  const response = await fetch(`${ssoConfig.apiBaseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`Yoma API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

export async function getYomaUser(): Promise<any> {
  return yomaFetch('/v3/user');
}

export async function searchYomaCredentials(params?: Record<string, unknown>): Promise<any> {
  return yomaFetch('/v3/ssi/wallet/user/search', {
    method: 'POST',
    body: JSON.stringify(params ?? { pageNumber: 1, pageSize: 10 }),
  });
}

export async function getYomaCredential(credentialId: string): Promise<any> {
  return yomaFetch(`/v3/ssi/wallet/user/${credentialId}`, {
    method: 'POST',
  });
}
