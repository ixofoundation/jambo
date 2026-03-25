import { ssoConfig } from './config';
import { generatePKCE } from './pkce';

function generateState(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  const state = Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
  localStorage.setItem('sso_state', JSON.stringify({ value: state, ts: Date.now() }));
  return state;
}

export async function redirectToSSO(): Promise<void> {
  const state = generateState();
  const { codeChallenge } = await generatePKCE(state);

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: ssoConfig.clientId,
    redirect_uri: ssoConfig.redirectUri,
    scope: ssoConfig.scopes,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });

  window.location.href = `${ssoConfig.authorizationEndpoint}?${params.toString()}`;
}
