# Authentication

The app uses a two-layer authentication model: **Yoma SSO** (OIDC) establishes the user's identity, and **WebAuthn passkeys** authenticate their blockchain smart account. Both layers must succeed before the user is fully logged in.

## SSO with Yoma

The entry point for all users is Yoma's Keycloak-based SSO, using the **Authorization Code flow with PKCE**.

### Flow

1. User visits `/auth` and clicks "Sign in with Yoma"
2. App generates a PKCE code challenge and state parameter, then redirects to Yoma's authorization endpoint (`lib/sso/redirect.ts`)
3. User authenticates on Yoma (email/password, social login, etc.)
4. Yoma redirects back to `/auth/passkey` with an authorization code
5. The callback page (`pages/auth/passkey.tsx`) validates the state parameter (CSRF protection with 10-minute TTL), exchanges the code for tokens via the token endpoint, and validates the ID token JWT against Yoma's JWKS
6. User info (email, name, picture) is staged in `sessionStorage` via `savePendingSSO()`
7. User is redirected to `/auth/login` (passkey login) or `/auth/register` (new account)

### Key Files

| File | Purpose |
| --- | --- |
| `lib/sso/config.ts` | SSO configuration (issuer, client ID, endpoints) |
| `lib/sso/pkce.ts` | PKCE code verifier/challenge generation |
| `lib/sso/redirect.ts` | Build authorization URL and redirect |
| `lib/sso/tokens.ts` | Token exchange and JWT validation via `jose` |
| `lib/sso/pending.ts` | Stage/load/clear SSO data in sessionStorage |
| `pages/auth/index.tsx` | SSO entry point UI |
| `pages/auth/passkey.tsx` | SSO callback handler |
| `store/slices/ssoSlice.ts` | Redux state for SSO session (email, name, picture) |

### SSO Profile Sync

After passkey auth completes and Matrix is set up, the SSO profile (display name and avatar) is synced to the user's Matrix account via `syncMatrixProfileFromSSO()` in `lib/auth/passkeyFlow.ts`.

## Passkey Registration

New users who don't yet have a blockchain account go through registration at `/auth/register`.

### Flow

1. **Generate wallet**: A fresh mnemonic is generated, and a secp256k1 wallet is derived from it
2. **Mnemonic backup**: User is shown their mnemonic and must acknowledge they've backed it up (`SecretPhraseStep` component)
3. **Feegrant**: A fee grant is requested in the background so the user can transact without holding tokens (`ensureFeegrant()`)
4. **Passkey creation**: `navigator.credentials.create()` registers a WebAuthn credential. The credential is added on-chain via `MsgAddAuthenticator`. The passkey display name includes the SSO name if available.
5. **On-chain verification**: The app queries the blockchain to confirm the authenticator was registered
6. **DID creation**: A deterministic DID (`did:ixo:<address>`) is computed from the wallet address
7. **Background setup** (runs after the blocking phase completes):
   - Create the DID on-chain via `MsgCreateIidDocument`
   - Generate a Matrix-specific mnemonic (separate from wallet mnemonic)
   - Register a Matrix account (username derived from address, password from Matrix mnemonic)
   - Set up cross-signing for E2E encryption
   - Create a private Matrix room via Room Bot
   - Prompt user for a PIN, encrypt the Matrix mnemonic, and store it in Matrix room state

### Key Files

| File | Purpose |
| --- | --- |
| `screens/registerPasskey.tsx` | Registration UI and flow orchestration |
| `lib/auth/passkeyFlow.ts` | `passkeyRegisterBlocking()` and `registerBackground()` |
| `lib/authn/register.ts` | Low-level WebAuthn credential creation |
| `utils/secp.ts` | Wallet derivation from mnemonic |
| `utils/feegrant.ts` | Feegrant check and grant |
| `utils/did.ts` | DID document creation and verification method management |

## Passkey Login

Returning users with an existing passkey authenticate at `/auth/login`.

### Flow

1. **Challenge**: Fetch a WebAuthn challenge from `/api/auth/initial-challenge`
2. **Assertion**: `navigator.credentials.get()` prompts for biometric/PIN and returns a signed assertion
3. **Address resolution**: The passkey's `keyId` is used to query blockchain GraphQL for associated smart account addresses
4. **Address selection**: If multiple addresses exist for the key, the user selects one. If only one, it auto-selects.
5. **Finalization** (`passkeyLoginBlockingFinalize`):
   - Verify the DID exists on-chain
   - Fetch the encrypted Matrix mnemonic from the server via `loginPasskey()`
6. **Background Matrix setup** (`matrixLoginBackground`):
   - Prompt user for PIN to decrypt the Matrix mnemonic
   - Login to Matrix with derived credentials
   - Set up cross-signing
   - Sync SSO profile to Matrix

### Key Files

| File | Purpose |
| --- | --- |
| `screens/loginPasskey.tsx` | Login UI, address selection, flow orchestration |
| `lib/auth/passkeyFlow.ts` | `passkeyLoginBlocking()`, `passkeyLoginBlockingFinalize()`, `matrixLoginBackground()` |
| `lib/authn/login.ts` | Low-level WebAuthn assertion verification |
| `pages/api/auth/initial-challenge.ts` | Server-side WebAuthn challenge generation |
| `pages/api/auth/get-secret.ts` | Encrypted mnemonic retrieval |

## Auth State Management

### AuthContext / useAuth

The `AuthProvider` (in `providers/auth.tsx`) wraps the entire app and exposes auth state via `AuthContext`:

- `isLoggedIn` -- whether the user has a valid session
- `isLoading` -- whether auth state is being determined
- `address` -- the user's blockchain address
- `did` -- the user's DID (`did:ixo:entity:<address>`)
- `onSign(messages)` -- signs and broadcasts blockchain transactions
- `logout()` -- clears session and redirects to `/auth`

Access via `useAuth()` hook in any component.

### BackgroundSetupProvider / useBackgroundSetup

The `BackgroundSetupProvider` manages the asynchronous setup phases (DID creation, Matrix setup) that run after the blocking auth phase completes. It provides:

- `startSetup(callback)` -- starts the background setup
- `awaitCompletion()` -- returns a promise that resolves when background setup is done (used to gate actions that require Matrix)
- `getFlowCallbacks()` -- returns `onStatusUpdate` and `requestPin` callbacks for the passkey flow

### Route Guards

- `GuestGuard` -- wraps auth pages, redirects to dashboard if already logged in
- `AuthGuard` -- wraps protected pages, redirects to `/auth` if not logged in

## Feegrant

Feegrants enable gasless transactions for users who don't hold IXO tokens:

- `checkAddressFeegrant(address)` queries the chain to check if a feegrant exists
- `grantFeegrant(address)` calls the `/api/feegrant/grant` API route, which uses a server-side key to issue a feegrant
- Called during both registration and login flows

## DID (IID Document)

Each user has a decentralized identity document (IID) on the IXO blockchain:

- Follows the W3C DID standard
- Created via `MsgCreateIidDocument` during registration
- Contains verification methods (secp256k1 for wallet, Ed25519 for claim signing)
- Ed25519 verification methods are added on-demand when a user first submits a claim (`buildAddEd25519VerificationMsg` in `utils/did.ts`)
