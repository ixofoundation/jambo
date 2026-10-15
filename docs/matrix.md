# Matrix Data Store

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

## Credential Storage

Issued credentials (e.g. KYC) are stored in the user's personal room using a two-event split that mirrors the impacts-x-web app, so credentials written here are readable from there:

- **Timeline event** `ixo.credential` — content `{ credential: JSON.stringify(credential) }` (double-stringified to sidestep Matrix's float restrictions). Auto-encrypted by Megolm because the room has E2EE enabled, so credential PII never leaves the encrypted timeline.
- **State event** `ixo.credential.index` (state key = credential type) — content `{ entries: IndexEntry[] }` where each entry is `{ eventId, cid, storedAt, issuerDid, holderDid, credentialType, format }`. Plaintext, no PII; used for discovery and duplicate detection by CID.

Implementation: `utils/matrixCredential.ts` (`storeMatrixCredential`, `computeCredentialCid`). Called from `hooks/useKycStatus.ts` after KYC reaches a terminal success state.

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

## Client Lifecycle and Local Stores

`BackgroundSetupProvider` (`providers/backgroundSetup.tsx`) starts the Data Store client; `createMatrixClient()` and `logoutMatrixClient()` live in `utils/matrix.ts`. The rules below exist because of IXO-5449 (a learner stuck on "the account in the store doesn't match the account in the constructor" on every load).

### Per-device crypto store

The rust crypto store (IndexedDB `<prefix>::matrix-sdk-crypto` and `<prefix>::matrix-sdk-crypto-meta`) is bound to one (user, device). Opening it with another device id fails, and the SDK leaks its store handle on that failure until the page goes away.

- Every login saves a per-device prefix, `matrix-js-sdk-<deviceId>` (`cryptoDbPrefixForDevice`, secret key `mx_ixo_crypto_db_prefix`), next to the tokens, and `createMatrixClient()` passes it to `initRustCrypto({ cryptoDatabasePrefix })`.
- Sessions saved before this change have no stored prefix and keep the SDK default `matrix-js-sdk` (`LEGACY_CRYPTO_DB_PREFIX`), so existing sessions are untouched.
- **Self-heal**: if `initRustCrypto` still reports the account mismatch, the client is stopped, the device is moved to its per-device prefix and `createMatrixClient()` retries once. The retry opens a different database, so the leaked handle does not matter and no reload is needed.
- If the mismatch persists after that retry, the provider signs the user out ("Your Data Store needs to be set up again") so the next sign-in runs the fresh-login path.
- **Garbage collection**: before opening anything, `createMatrixClient()` deletes (fire-and-forget) every rust crypto store (`matrix-js-sdk[-<deviceId>]::matrix-sdk-crypto[-meta]`) that does not belong to the current prefix. The match is exact: the SDK's sync store is named `matrix-js-sdk:matrix-sync-store` (single colon) and must never be swept. Once a per-device store works, it also deletes the two legacy names. A blocked delete is never awaited.

### Fresh login and sign-out

- Saved Data Store tokens for a different account than the signed-in one (a previous learner on a shared device) are never reattached: the provider resets the local session, then runs the fresh login if a mnemonic is available, or signs out.
- `setupMatrix` calls `resetLocalMatrixSession()` before `mxLogin()`. It stops every client, drops the secret-storage keys, deletes the Matrix databases (bounded wait) and clears the tokens, so a new device never opens leftovers.
- Every client `createMatrixClient()` creates is tracked. Any start failure (sync-store startup, `initRustCrypto`, sync `ERROR`) stops the client and closes its sync store before rethrowing, so a failed start never keeps the stores open. `stopAllMatrixClients()` stops them all.
- `logoutMatrixClient()` runs in this order: capture the credentials, stop all clients, drop the secret-storage keys, **clear the tokens** (early, so they can never survive the auth provider's 8 s safety timeout), clear the session lock, revoke the device on the homeserver with a bare client, then delete the stores (each step bounded).

### One tab at a time (session lock)

`utils/sessionLock.ts` is a localStorage lock (ping every 5 s, expires after 15 s, `storage` events), adapted from the portal and element-web. The provider takes the lock before creating a client on both the reattach and the fresh-login path.

- If another tab holds the lock, the provider shows "The Data Store is open in another tab" with a **Use here** button. The button claims the lock, the other tab stops its client (which closes the crypto store), and setup runs again here.
- A tab that loses the lock stops its client and shows the same message.
- The lock is released on `pagehide`, when a start fails, and at sign-out. Sign-out also removes the lock entries, which tells any other tab that the session ended. The lock of a tab that died expires on its own.

### Revoked sessions

Matrix sessions here do not expire, but a device can be deleted on the server. When the homeserver answers `M_UNKNOWN_TOKEN`, the SDK emits `HttpApiEvent.SessionLoggedOut`. During startup, `createMatrixClient()` throws `MatrixSessionInvalidError` instead. In both cases the provider shows "Your Data Store session has ended" and signs the user out, once. If the revoked device is no longer the saved session (another tab already signed in again), it only stops its own stale client.

### No setup on the auth callback page

`/auth/callback` always ends in a full-page `window.location.replace`. A Matrix login started there would be torn down mid-flight: the homeserver mints an orphan "JAMBO CLAIMS" device, and the fresh-login path would start in one document and be observed half-done in the next. The provider therefore skips auto-setup on that page, and the landing page runs it.

## Environment Variables

| Variable                            | Description                |
| ----------------------------------- | -------------------------- |
| `NEXT_PUBLIC_MATRIX_HOMESERVER_URL` | Matrix homeserver base URL |
| `NEXT_PUBLIC_MATRIX_ROOM_BOT_URL`   | Room Bot service URL       |
| `NEXT_PUBLIC_MATRIX_BID_BOT_URL`    | Bid Bot service URL        |
| `NEXT_PUBLIC_MATRIX_CLAIM_BOT_URL`  | Claim Bot service URL      |
