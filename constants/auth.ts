const authConstants = {
  secretKey: {
    ADDRESS: 'auth_ixo_address',
    DID: 'auth_ixo_did',
    SESSION_MNEMONIC: 'auth_ixo_session_mnemonic',
    SESSION_AUTHENTICATOR_ID: 'auth_ixo_session_authenticator_id',
    ED_SIGNING_MNEMONIC: 'auth_ixo_ed_signing_mnemonic',
    MATRIX_MNEMONIC: 'auth_ixo_matrix_mnemonic',
    MATRIX_USER_ID: 'auth_ixo_matrix_user_id',
    MATRIX_ROOM_ID: 'auth_ixo_matrix_room_id',
    DISPLAY_NAME: 'auth_ixo_display_name',
    EMAIL: 'auth_ixo_email',
    SESSION_CREATED_AT: 'auth_ixo_session_created_at',
  },
};

Object.freeze(authConstants);

export default authConstants;
