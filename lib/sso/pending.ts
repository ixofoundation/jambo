const PENDING_SSO_KEY = 'sso_pending';

export interface PendingSSOData {
  idToken: string;
  email: string | null;
  name: string | null;
  picture: string | null;
}

export function savePendingSSO(data: PendingSSOData): void {
  sessionStorage.setItem(PENDING_SSO_KEY, JSON.stringify(data));
}

export function loadPendingSSO(): PendingSSOData | null {
  const raw = sessionStorage.getItem(PENDING_SSO_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearPendingSSO(): void {
  sessionStorage.removeItem(PENDING_SSO_KEY);
}
