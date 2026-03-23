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

  sessionStorage.setItem(`sso_verifier_${state}`, codeVerifier);

  return { codeVerifier, codeChallenge };
}

export function getCodeVerifier(state: string): string | null {
  const key = `sso_verifier_${state}`;
  const verifier = sessionStorage.getItem(key);
  sessionStorage.removeItem(key);
  return verifier;
}
