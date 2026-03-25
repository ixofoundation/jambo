function generateRandomString(length: number): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
}

async function sha256(plain: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  return crypto.subtle.digest('SHA-256', encoder.encode(plain));
}

function base64UrlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function generatePKCE(state: string): Promise<{ codeVerifier: string; codeChallenge: string }> {
  const codeVerifier = generateRandomString(64);
  const digest = await sha256(codeVerifier);
  const codeChallenge = base64UrlEncode(digest);

  localStorage.setItem(`sso_verifier_${state}`, JSON.stringify({ value: codeVerifier, ts: Date.now() }));

  return { codeVerifier, codeChallenge };
}

const SSO_TTL_MS = 10 * 60 * 1000; // 10 minutes

export function getCodeVerifier(state: string): string | null {
  const key = `sso_verifier_${state}`;
  const raw = localStorage.getItem(key);
  localStorage.removeItem(key);
  if (!raw) return null;
  try {
    const { value, ts } = JSON.parse(raw);
    if (Date.now() - ts > SSO_TTL_MS) return null;
    return value;
  } catch {
    return null;
  }
}
