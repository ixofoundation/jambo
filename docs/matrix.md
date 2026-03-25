# Matrix Data Vault

The app uses the Matrix protocol as a **secure, decentralized storage layer** rather than a messaging platform. Each user has a private Matrix room that stores encrypted credentials, signing mnemonics, and serves as the interface for interacting with IXO's Matrix bots.

## Architecture Overview

```
User
  |
  +--> Matrix Homeserver (e.g., devmx.ixo.earth)
  |      |
  |      +--> User's Private Room
  |      |      - encrypted_mnemonic (Matrix mnemonic, PIN-encrypted)
  |      |      - encrypted_signing_mnemonic (claim signing mnemonic, PIN-encrypted)
  |      |
  |      +--> E2E Encryption (cross-signing)
  |
  +--> Matrix Bots
         +--> Room Bot -- creates user rooms
         +--> Bid Bot -- manages agent applications
         +--> Claim Bot -- stores claim data, returns CIDs
```

## Account Lifecycle

Matrix accounts are deterministically derived from blockchain addresses:

- **Username**: Derived from the blockchain address via `generateUsernameFromAddress(address)`
- **Password**: Derived from a Matrix-specific mnemonic via `generatePasswordFromMnemonic(mnemonic)`
- **Registration**: Uses secp256k1 signature-based registration via `mxRegisterWithSecp()` (proves ownership of the blockchain address)
- **Login**: Standard Matrix password login via `mxLogin()`

All Matrix credential derivation functions are in `utils/matrix.ts`.

## Matrix Mnemonic

The Matrix mnemonic is **separate from the wallet mnemonic**. This separation ensures that compromise of one does not compromise the other.

- **Generated**: During registration (`utils.mnemonic.generateMnemonic(12)`)
- **Encrypted**: With the user's PIN using AES via `encrypt()` from `utils/encryption.ts`
- **Stored**: In the user's Matrix room state at event type `ixo.room.state.secure`, state key `encrypted_mnemonic`
- **Retrieved during login**: Fetched via the authn API (`loginPasskey()` → `/api/auth/get-secret`), then decrypted with the user's PIN
- **Backup**: During setup, the mnemonic is backed up to `secureWebStorage` so the flow can resume if interrupted (cleared on completion)

## Signing Mnemonic

A second mnemonic is used specifically for **Ed25519 claim signing** (W3C Verifiable Credentials):

- **Generated**: On first claim submission via `generateSigningMnemonic()` (24-word mnemonic)
- **Encrypted**: With the user's PIN, stored in Matrix room state at `ixo.room.state.secure/encrypted_signing_mnemonic`
- **Used for**: Deriving an Ed25519 keypair (`deriveEd25519KeyPairFromMnemonic()` in `utils/veramo.ts`), creating a Veramo agent, and signing claim VCs
- **Key files**: `utils/signingMnemonic.ts` (generation, fetch, store, decrypt)

## Cross-Signing

Cross-signing is set up during registration and login to enable Matrix E2E encryption:

- `hasCrossSigningAccountData(mxClient)` checks if cross-signing is already configured
- `setupCrossSigning(mxClient, { securityPhrase, password, forceReset })` bootstraps cross-signing keys
- The security passphrase is derived from the Matrix mnemonic via `generatePassphraseFromMnemonic()`
- Cross-signing enables encrypted room state and data recovery across devices

## Matrix Bots

Three Matrix bots handle off-chain data operations:

### Room Bot
- **URL**: `NEXT_PUBLIC_MATRIX_ROOM_BOT_URL`
- **Purpose**: Creates user-specific Matrix rooms
- **Endpoint**: `POST /room/source` with `{ did, userMatrixId }`
- **When used**: During registration, after Matrix account creation

### Bid Bot
- **URL**: `NEXT_PUBLIC_MATRIX_BID_BOT_URL`
- **Purpose**: Manages agent application bids (off-chain)
- **Client**: Created via `createMatrixBidBotClient()` from `@ixo/matrixclient-sdk`
- **Key methods**:
  - `submitBid(collectionId, data, role, openIdToken, did)` -- submit an agent application
  - `queryBidsByDid(collectionId, did, openIdToken, did)` -- check bid status
- **When used**: Agent application flow, dashboard status checks

### Claim Bot
- **URL**: `NEXT_PUBLIC_MATRIX_CLAIM_BOT_URL`
- **Purpose**: Stores signed claim data (Verifiable Credentials) off-chain, returns a CID
- **Client**: Created via `createMatrixClaimBotClient()` from `@ixo/matrixclient-sdk`
- **Key methods**:
  - `saveClaim(collectionId, signedVC, openIdToken, did)` -- store claim, returns `{ data: { cid } }`
  - `queryClaim(collectionId, claimId, openIdToken, did)` -- retrieve claim data for viewing
- **When used**: Claim submission and claim viewing in collection detail

## OpenID Tokens

Matrix bots require OpenID tokens for authentication:

- `getMatrixOpenIdToken()` in `utils/matrix.ts` obtains a token from the Matrix homeserver
- Tokens are passed to bot API calls for identity verification

## SSO Profile Sync

After Matrix login/registration, the user's Yoma SSO profile is synced to Matrix:

- **Display name**: Set from SSO `name` or `email`
- **Avatar**: Downloaded from SSO `picture` URL, uploaded to Matrix, set as avatar
- Function: `syncMatrixProfileFromSSO()` in `lib/auth/passkeyFlow.ts`
- SSO data is read from Redux store (`sso` slice)

## Environment Variables

| Variable | Description |
| --- | --- |
| `NEXT_PUBLIC_MATRIX_HOMESERVER_URL` | Matrix homeserver base URL |
| `NEXT_PUBLIC_MATRIX_ROOM_BOT_URL` | Room Bot service URL |
| `NEXT_PUBLIC_MATRIX_BID_BOT_URL` | Bid Bot service URL |
| `NEXT_PUBLIC_MATRIX_CLAIM_BOT_URL` | Claim Bot service URL |
