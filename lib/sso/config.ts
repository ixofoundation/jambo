const issuer = process.env.NEXT_PUBLIC_YOMA_SSO_ISSUER ?? 'https://stage.yoma.world/auth/realms/yoma';

export const ssoConfig = {
  issuer,
  clientId: process.env.NEXT_PUBLIC_YOMA_SSO_CLIENT_ID ?? '',
  redirectUri: process.env.NEXT_PUBLIC_YOMA_SSO_REDIRECT_URI ?? 'http://localhost:3000/auth/passkey',
  scopes: process.env.NEXT_PUBLIC_YOMA_SSO_SCOPES ?? 'openid email profile',
  authorizationEndpoint: `${issuer}/protocol/openid-connect/auth`,
  tokenEndpoint: `${issuer}/protocol/openid-connect/token`,
  jwksUri: `${issuer}/protocol/openid-connect/certs`,
  logoutEndpoint: `${issuer}/protocol/openid-connect/logout`,
};
