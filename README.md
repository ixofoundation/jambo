# JAMBO Passkey Claims

A mobile-first Next.js application for submitting verifiable claims against IXO blockchain claim collections. Users authenticate via Yoma SSO and WebAuthn passkeys, with Matrix serving as a secure, decentralized data store for credential storage and claim data.

## Tech Stack

- **Framework**: Next.js 12, React 18, TypeScript
- **State**: Redux Toolkit + redux-persist
- **Blockchain**: IXO (Cosmos SDK) via `@ixo/impactxclient-sdk`
- **Auth**: Yoma SSO (OIDC/Keycloak + PKCE), WebAuthn/FIDO2 passkeys
- **Data Store**: Matrix protocol via `matrix-js-sdk` + `@ixo/matrixclient-sdk`
- **Forms**: SurveyJS (dynamic claim/application forms)
- **Credentials**: Veramo (W3C Verifiable Credentials, Ed25519 signing)

## Getting Started

1. **Clone the repository**

   ```bash
   git clone https://github.com/ixofoundation/jambo-claims.git
   cd jambo-claims
   ```

2. **Install dependencies**

   ```bash
   yarn install
   ```

3. **Set environment variables**

   Create a `.env` file based on `.env.example`:

   ```env
   # WebAuthn / Passkey
   NEXT_PUBLIC_AUTHN_ORIGIN=http://localhost:3000
   NEXT_PUBLIC_AUTHN_RP_ID=localhost

   # Blockchain
   NEXT_PUBLIC_CHAIN_NETWORK=devnet

   # Feegrant (gasless transactions)
   NEXT_PUBLIC_FEEGRANT_URL=""
   FEEGRANT_API_KEY=""

   # Matrix (Data Store)
   NEXT_PUBLIC_MATRIX_HOMESERVER_URL=""
   NEXT_PUBLIC_MATRIX_ROOM_BOT_URL=""
   NEXT_PUBLIC_MATRIX_BID_BOT_URL=""
   NEXT_PUBLIC_MATRIX_CLAIM_BOT_URL=""

   # Yoma SSO (OIDC/Keycloak)
   NEXT_PUBLIC_YOMA_SSO_ISSUER=https://stage.yoma.world/auth/realms/yoma
   NEXT_PUBLIC_YOMA_SSO_CLIENT_ID=<your_client_id>
   NEXT_PUBLIC_YOMA_SSO_REDIRECT_URI=http://localhost:3000/auth/passkey
   NEXT_PUBLIC_YOMA_SSO_SCOPES=openid email profile
   ```

4. **Start the development server**

   ```bash
   yarn dev
   ```

   The app will be available at `http://localhost:3000`.

## SDKs

| SDK | Description |
| --- | --- |
| [`@ixo/impactxclient-sdk`](https://www.npmjs.com/package/@ixo/impactxclient-sdk) | TypeScript SDK for the IXO blockchain. Transaction building, DID creation, signing, and Cosmos-based features. |
| [`@ixo/matrixclient-sdk`](https://www.npmjs.com/package/@ixo/matrixclient-sdk) | Wrapper for IXO Matrix Bots (Claim Bot, Bid Bot, Room Bot). |
| [`matrix-js-sdk`](https://www.npmjs.com/package/matrix-js-sdk) | Official Matrix client library for registration, login, and homeserver interaction. |
| [`@ixo/signx-sdk`](https://www.npmjs.com/package/@ixo/signx-sdk) | SignX mobile wallet integration for transaction signing. |

## Project Structure

```
pages/              Next.js pages and API routes
  api/              Server-side API endpoints (auth, feegrant, matrix)
  auth/             Auth pages (SSO entry, callback, login, register)
  entities/         Entity dashboard and collection detail pages
screens/            Page-level screen components
components/         Reusable UI components
hooks/              React hooks (useAuth, useBackgroundSetup, useProtocolCollections)
lib/
  auth/             Passkey flow orchestration (blocking + background phases)
  authn/            Low-level WebAuthn registration/login, passkey signing
  sso/              Yoma SSO OIDC helpers (PKCE, redirect, token exchange)
store/
  slices/           Redux slices (account, collections, entities, protocols, sso, etc.)
  thunks/           Async thunks for data fetching
utils/              Shared utilities (claims, DID, matrix, veramo, encryption, etc.)
constants/          App configuration, chain networks, transaction types
styles/             Global SCSS and CSS variables
```

## Documentation

Detailed documentation is available in the [`docs/`](docs/) directory:

- [Authentication](docs/authentication.md) -- SSO, passkeys, identity, and auth state
- [Matrix Data Store](docs/matrix.md) -- Matrix integration, mnemonics, bots, and encryption
- [Claims and Collections](docs/claims.md) -- Claim submission, collections, drafts, and evaluation
- [Agent Application](docs/agent-application.md) -- Bid/agent application flow and authorization
- [Project Structure](docs/project-structure.md) -- Architecture, routing, store, API routes, and environment variables
