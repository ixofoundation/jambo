import { getValidAccessToken } from './refresh';

async function yomaFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = await getValidAccessToken();
  if (!token) throw new Error('Yoma SSO session expired');

  const response = await fetch(`/api/yoma${path}`, {
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
  return yomaFetch('/user');
}

export async function searchYomaCredentials(params?: Record<string, unknown>): Promise<any> {
  return yomaFetch('/credentials/search', {
    method: 'POST',
    body: JSON.stringify(params ?? { pageNumber: 1, pageSize: 10 }),
  });
}

export async function getYomaCredential(credentialId: string): Promise<any> {
  return yomaFetch(`/credentials/${credentialId}`, {
    method: 'POST',
  });
}
