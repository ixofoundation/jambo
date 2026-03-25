# Project Structure

## Directory Layout

```
jambo-passkey-claims/
  pages/                    Next.js file-based routing
    _app.tsx                App wrapper (providers, global styles)
    _document.tsx           Custom HTML document
    index.tsx               Root redirect (auth or dashboard based on login state)
    profile.tsx             User profile page
    api/
      auth/
        initial-challenge.ts  Generate WebAuthn challenge
        get-secret.ts         Fetch encrypted mnemonic (passkey auth)
        get-secret-secp.ts    Fetch encrypted mnemonic (secp256k1 auth)
      feegrant/
        grant.ts              Issue feegrant to an address (server-side)
      matrix/
        create-user.ts        Matrix user registration helper
        public-key.ts         Public key endpoint for Matrix auth
    auth/
      index.tsx              SSO entry point (redirects to Yoma)
      passkey.tsx            SSO callback handler
      login.tsx              Passkey login page
      register.tsx           Passkey registration page
    entities/
      [entityId]/
        index.tsx            Entity dashboard
        claimCollections/
          [collectionId].tsx Collection detail page

  screens/                   Page-level React components
    loginMethodSelector.tsx  Legacy login method selector
    loginPasskey.tsx         Passkey login flow UI
    loginMnemonic.tsx        Mnemonic login flow UI (legacy)
    loginSignX.tsx           SignX mobile wallet login UI
    registerPasskey.tsx      Passkey registration flow UI
    dashboard.tsx            Entity dashboard with collections list
    collectionDetail.tsx     Single collection: claims, agent application, submission
    profile.tsx              User profile with Matrix credentials viewer

  components/                Reusable UI components
    AuthGuard.tsx            Redirect to /auth if not logged in
    GuestGuard.tsx           Redirect to dashboard if already logged in
    AuthHeader/              Auth page header (logo + branding)
    Header/                  Main app header (navigation, profile link)
    HeaderStatusIndicator/   Background setup status indicator
    Button/                  Styled button component
    GradientBand/            Decorative gradient background
    Loader/                  Loading spinner
    MatrixPinForm/           PIN entry form (for mnemonic encryption)
    Modal/                   Generic modal overlay
    SecretPhraseStep/        Mnemonic backup step (show + confirm)
    SignX/                   SignX QR code component
    Toast/                   Toast notifications (react-toastify wrapper)

  hooks/
    useAuth.ts               Auth context accessor
    useBackgroundSetup.ts    Background setup context accessor
    useProtocolCollections.ts Collection data hook with entity filtering
    useSteps.ts              Step navigation helper for multi-step flows

  lib/
    auth/
      passkeyFlow.ts         High-level passkey registration/login orchestration
    authn/
      client.ts              WebAuthn client utilities
      login.ts               Passkey login (assertion → server verification)
      register.ts            Passkey registration (create + on-chain)
      signAndBroadcast.ts    Sign and broadcast transactions (passkey signer)
      signAndBroadcastSignX.ts  Sign and broadcast via SignX
      PasskeyOfflineDirectSigner.ts  Cosmos SDK signer using passkeys
      utils.ts               Authn helper utilities
    sso/
      config.ts              Yoma SSO OIDC configuration
      pkce.ts                PKCE code verifier/challenge generation
      redirect.ts            Build SSO authorization URL and redirect
      tokens.ts              Token exchange and JWT validation
      pending.ts             Stage SSO data between callback and login

  store/
    index.ts                 Redux store configuration with redux-persist
    hooks.ts                 Typed useAppSelector / useAppDispatch hooks
    provider.tsx             Redux provider with PersistGate
    slices/
      accountSlice.ts        Wallet/account state
      collectionsSlice.ts    Claim collections (normalized by ID, indexed by entity)
      entitiesSlice.ts       Entity data cache
      protocolsSlice.ts      Protocol VCT templates and form names
      profilesSlice.ts       Entity profile data (name, logo, type)
      ssoSlice.ts            SSO session state (email, name, picture)
      matrixProfileSlice.ts  Matrix profile state (display name, avatar)
      claimDraftsSlice.ts    Auto-saved claim form drafts
    thunks/
      dataThunks.ts          fetchAllCollectionData async thunk

  utils/
    claims.ts                GraphQL queries for collections and claims
    did.ts                   DID document creation and verification methods
    encoding.ts              Base64url encode/decode
    encryption.ts            AES encrypt/decrypt (crypto-js)
    entity.ts                Fetch protocol entities from Blocksync
    feegrant.ts              Feegrant check and grant
    graphql.ts               Generic GraphQL query helper
    matrix.ts                Matrix client, login, registration, cross-signing
    persistence.ts           Persist store to local storage
    secp.ts                  Secp256k1 wallet client
    secrets.ts               In-memory secret store (access tokens, etc.)
    secretStorageKeys.ts     Secret storage key helpers
    signingMnemonic.ts       Ed25519 signing mnemonic management
    signX.tsx                SignX SDK initialization
    storage.ts               Secure web storage wrapper
    timestamp.ts             Delay utility
    transaction.ts           Transaction broadcasting helpers
    url.ts                   Service endpoint resolution and data fetching
    veramo.ts                Veramo agent, Ed25519 key derivation, VC signing

  constants/
    auth.ts                  Auth-related constants
    common.ts                Chain networks, RPC URLs, Blocksync URLs, chain IDs
    config.json              Site configuration (name, entity DID, protocols, actions)
    events.ts                Event constants
    gradientColors.ts        Gradient color presets for different screens
    matrix.ts                Matrix secret key names
    surveyTheme.ts           SurveyJS theme configuration
    transaction.ts           Transaction type URLs (authz grant types)
    urls.ts                  URL constants

  styles/
    globals.scss             Global styles
    variables.scss           CSS custom properties (colors, spacing, layout)
```

## Provider Hierarchy

The app wraps components in this provider order (defined in `pages/_app.tsx`):

```
ReduxProvider (Redux store + PersistGate)
  ThemeProvider (light/dark theme via CSS variables)
    AuthProvider (auth state, login/logout, onSign)
      BackgroundSetupProvider (async setup phases, PIN prompts)
        <Page Component>
        <ToastContainer>
```

## Routing

| Route | Page | Guard | Screen |
| --- | --- | --- | --- |
| `/` | `index.tsx` | None | Redirects to `/entities/:id` or `/auth` |
| `/auth` | `auth/index.tsx` | GuestGuard | SSO entry point (Yoma sign-in button) |
| `/auth/passkey` | `auth/passkey.tsx` | None | SSO callback handler |
| `/auth/login` | `auth/login.tsx` | GuestGuard | Passkey login |
| `/auth/register` | `auth/register.tsx` | GuestGuard | Passkey registration |
| `/entities/[entityId]` | `entities/[entityId]/index.tsx` | AuthGuard | Dashboard |
| `/entities/[entityId]/claimCollections/[collectionId]` | `entities/[entityId]/claimCollections/[collectionId].tsx` | AuthGuard | Collection detail |
| `/profile` | `profile.tsx` | AuthGuard | User profile |

## Redux Store Shape

```typescript
{
  account: {
    // Wallet and account state
  },
  collections: {
    byId: Record<string, CollectionData>,    // All collections by ID
    byEntityDid: Record<string, string[]>,   // Collection IDs per entity
    fetchedAt: Record<string, number>,       // Fetch timestamps per entity
    loading: boolean
  },
  entities: {
    byId: Record<string, EntityData>         // Cached entity data
  },
  protocols: {
    vctTemplates: Record<string, any>,       // VCT templates by protocol DID
    formNames: Record<string, string>        // Form display names by protocol DID
  },
  profiles: {
    byEntityDid: Record<string, { name, logo, type }>  // Entity profiles
  },
  sso: {
    isAuthenticated: boolean,
    idToken: string | null,
    email: string | null,
    name: string | null,
    picture: string | null
  },
  matrixProfile: {
    displayName: string | null,
    avatarUrl: string | null
  },
  claimDrafts: {
    byCollectionId: Record<string, {
      surveyMode: 'bid' | 'claim',
      surveyTemplate: string,
      surveyData: Record<string, any>,
      updatedAt: number
    }>
  }
}
```

## API Routes

| Route | Method | Purpose |
| --- | --- | --- |
| `/api/auth/initial-challenge` | GET | Generate a WebAuthn authentication challenge |
| `/api/auth/get-secret` | POST | Retrieve encrypted mnemonic for a passkey-authenticated user |
| `/api/auth/get-secret-secp` | POST | Retrieve encrypted mnemonic via secp256k1 signature |
| `/api/feegrant/grant` | POST | Issue a feegrant to a user address (uses server-side `FEEGRANT_API_KEY`) |
| `/api/matrix/create-user` | POST | Helper for Matrix user registration |
| `/api/matrix/public-key` | GET | Public key endpoint for Matrix auth verification |

## Environment Variables

| Variable | Public | Description |
| --- | --- | --- |
| `NEXT_PUBLIC_AUTHN_ORIGIN` | Yes | WebAuthn relying party origin (e.g., `http://localhost:3000`) |
| `NEXT_PUBLIC_AUTHN_RP_ID` | Yes | WebAuthn relying party ID (e.g., `localhost`) |
| `NEXT_PUBLIC_CHAIN_NETWORK` | Yes | Blockchain network: `mainnet`, `testnet`, `devnet`, or `local` |
| `NEXT_PUBLIC_FEEGRANT_URL` | Yes | Feegrant service URL |
| `FEEGRANT_API_KEY` | No | Server-side API key for feegrant issuance |
| `NEXT_PUBLIC_MATRIX_HOMESERVER_URL` | Yes | Matrix homeserver base URL |
| `NEXT_PUBLIC_MATRIX_ROOM_BOT_URL` | Yes | Room Bot service URL |
| `NEXT_PUBLIC_MATRIX_BID_BOT_URL` | Yes | Bid Bot service URL |
| `NEXT_PUBLIC_MATRIX_CLAIM_BOT_URL` | Yes | Claim Bot service URL |
| `NEXT_PUBLIC_YOMA_SSO_ISSUER` | Yes | Yoma Keycloak realm URL |
| `NEXT_PUBLIC_YOMA_SSO_CLIENT_ID` | Yes | OIDC client ID for this app |
| `NEXT_PUBLIC_YOMA_SSO_REDIRECT_URI` | Yes | OAuth redirect URI (must match Keycloak config) |
| `NEXT_PUBLIC_YOMA_SSO_SCOPES` | Yes | OIDC scopes (default: `openid email profile`) |
| `NEXT_PUBLIC_DEFAULT_ENTITY` | Yes | Default entity DID for the dashboard (overrides `config.json`) |

## Key Constants

- **Chain config** (`constants/common.ts`): Network-dependent RPC URLs, Blocksync GraphQL URLs, chain IDs
- **Transaction types** (`constants/transaction.ts`): Authz type URLs for `SubmitClaimAuthorization` and `EvaluateClaimAuthorization`
- **Site config** (`constants/config.json`): Site name, default entity DID, protocol DIDs, legacy action definitions
- **Survey theme** (`constants/surveyTheme.ts`): Custom SurveyJS theme with dark mode support
