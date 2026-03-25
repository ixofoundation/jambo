const authConstants = {
  secretKey: {
    CREDENTIAL_ID: 'auth_ixo_credential_id',
    ADDRESS: 'auth_ixo_address',
    DID: 'auth_ixo_did',
    AUTHENTICATOR_ID: 'auth_ixo_authenticator_id',
  },
  yomaKey: {
    ACCESS_TOKEN: 'yoma_access_token',
    REFRESH_TOKEN: 'yoma_refresh_token',
    EXPIRES_AT: 'yoma_expires_at',
  },
};

Object.freeze(authConstants);

export default authConstants;
