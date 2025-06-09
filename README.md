# JAMBO Claims

## Getting Started

1. **Clone the Repository**

   - Clone the repository to your local machine

   ```bash
   git clone https://github.com/ixofoundation/jambo-claims.git
   cd jambo-claims
   ```

2. **Install Dependencies**

   ```bash
   yarn install
   ```

3. **Set Environment Variables**

   - Create a `.env` file in the root directory based on `.env.example`
   - Add the following environment variables:

   ```env
    NEXT_PUBLIC_AUTHN_ORIGIN=http://localhost:3000
    NEXT_PUBLIC_AUTHN_RP_ID=localhost
    NEXT_PUBLIC_CHAIN_NETWORK=devnet
    NEXT_PUBLIC_EMAIL_OTP_WORKER_URL="https://otp.email.ixo.earth"
    NEXT_PUBLIC_MATRIX_HOMESERVER_URL="https://devmx.ixo.earth"
    NEXT_PUBLIC_MATRIX_ROOM_BOT_URL="https://rooms.bot.devmx.ixo.earth"
    NEXT_PUBLIC_MATRIX_BID_BOT_URL="https://bid.bot.devmx.ixo.earth"
    NEXT_PUBLIC_MATRIX_CLAIM_BOT_URL="https://claim.bot.devmx.ixo.earth"
   ```

4. **Start Development Server**
   ```bash
   yarn dev
   ```
   The application will be available at `http://localhost:3000`

🎉 🎉 🎉 That's it!

## 📦 SDKs Used

This app leverages several core SDKs to interact with the blockchain, Matrix, and passkey infrastructure:

| SDK                                                                              | Description                                                                                                                                     | Link                                                               |
| -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| [`@ixo/impactxclient-sdk`](https://www.npmjs.com/package/@ixo/impactxclient-sdk) | TypeScript SDK for interacting with the IXO blockchain. Includes transaction building, DID creation, signing, and Cosmos-based features.        | [📘 Docs](https://docs.ixo.world/sdk/impactxclient)                |
| [`@ixo/matrixclient-sdk`](https://www.npmjs.com/package/@ixo/matrixclient-sdk)   | Lightweight wrapper for interacting with IXO Matrix Bots (e.g., Claim Bot, Bid Bot, Room Bot). Simplifies API calls to Matrix-powered features. | [📘 GitHub](https://github.com/ixofoundation/ixo-matrixclient-sdk) |
| [`matrix-js-sdk`](https://www.npmjs.com/package/matrix-js-sdk)                   | Official Matrix client library used to register, log in, and interact with Matrix homeservers directly.                                         | [📘 Docs](https://matrix-org.github.io/matrix-js-sdk/)             |

> ℹ️ These SDKs are configured to work with IXO’s infrastructure but can be extended for other use cases or custom networks.

## 📘 Concepts

This section introduces important terms and technologies used in the JAMBO Claims app. Understanding these concepts will help you navigate and customize the app effectively.

---

### 🔑 Passkeys (WebAuthn)

**Passkeys** are cryptographic credentials created via the WebAuthn standard.

- Linked to biometric sensors (e.g., Face ID, fingerprint).
- Stored securely in the browser or device.
- Replace traditional passwords with **passwordless login**.
- Used in this app for secure, user-friendly authentication of blockchain smart accounts.

> JAMBO Claims uses passkeys to authenticate smart accounts and enable secure DID creation.

### 🪙 Feegrant

**Feegrants** allow a third party (e.g. the IXO team) to pay blockchain gas fees on behalf of a user. This ensures gasless interactions for users who may not hold tokens.

- Used in this app to automatically fund new wallets.
- Managed via the [`MsgGrantAllowance`](https://docs.cosmos.network/v0.46/modules/feegrant/) Cosmos SDK module.

### 🪪 IID Document (DID)

The **IID Document** is a **decentralized identity document** stored on-chain. It:

- Follows the [W3C DID standard](https://www.w3.org/TR/did-core/).
- Contains cryptographic keys, metadata, and service endpoints.
- Is required for role-based access control on the IXO blockchain.

Created and updated using `MsgCreateIidDocument` and `MsgUpdateIidDocument`.

### 🟢 Matrix

Matrix is a **decentralized communication protocol**. It is used in JAMBO Claims for:

- **Secure data handling** between bots and users.
- **Private data storage** (e.g., claims, bid forms).
- **Encrypted identity coordination**.

The app interacts with a Matrix homeserver using the official [`matrix-js-sdk`](https://matrix-org.github.io/matrix-js-sdk/).

### 🔐 Matrix Mnemonic

A **Matrix-specific mnemonic** is a randomly generated seed phrase used to:

- Derive Matrix credentials deterministically.
- Encrypt and decrypt stored data in the Matrix room.

> 🚫 Not the same as the wallet mnemonic. This separation ensures better compartmentalization of access.

### 🏠 Matrix Room

A **Matrix room** is like a private chat space.

- Used as a **secure storage container** for bids data, claims data, and keys.
- Each claim collection's entity has its own dedicated Matrix room.
- Access is restricted to users with the correct authorization or encryption key.

### 🔒 Matrix End-to-End Encryption

All sensitive data in Matrix (e.g., claim answers) is **end-to-end encrypted**:

- Only the sender and authorized recipients can decrypt messages.
- Prevents IXO servers or unauthorized users from viewing content.

### 🔗 Matrix Cross-Signing

**Cross-signing** allows trust across multiple Matrix devices:

- A device signs the public keys of another device.
- Once trusted, data encrypted by one device can be decrypted by another.
- Enables seamless multi-device login and data recovery.

> ⚠️ Not mandatory for this app, but important for robust multi-device support and included for demonstration purposes.

### 🤖 Matrix Bid Bot

The **Matrix Bid Bot** manages off-chain bid submission and management.

- Listens to a specific Matrix room per claim collection.
- Validates bid data submitted by users via SurveyJS forms.
- Marks bids as **accepted** or **rejected** after admin approval.
- Maintains decentralized bid data separate from the blockchain.

### 🤖 Matrix Claim Bot

The **Matrix Claim Bot** securely stores sensitive claim data off-chain.

- Accepts form data (e.g., survey answers) and stores it in the Matrix room.
- Generates a content identifier (CID) for the data.
- Returns the CID, which is then referenced in the on-chain claim transaction.
- Ensures data is encrypted and only accessible to authorized evaluators.

> Together, the bots allow scalable and privacy-preserving workflows without putting sensitive data directly on the blockchain.

---

## 🔐 Login Methods

This app supports three login methods, integrating:

- **Blockchain smart accounts**
- **DID ledgering on the IXO chain**
- **Feegrant setup via email**
- **Passkey authentication (WebAuthn)**
- **Matrix account + encrypted credential management**

All methods ultimately establish a fully functional user session, with DID registration and a secure Matrix room used for encrypted credential storage and future recovery.

---

### 🧱 Common Setup Steps

These steps are performed (implicitly or explicitly) across all login methods:

1. **Feegrant Check**  
   Ensure the user's account has an active feegrant. If not, prompt for the user's email to automatically issue a feegrant to allow (limited) fee-less blockchain transactions.

2. **DID Ledgering**  
   Ensure the user has a valid IID document (decentralized identifier) on the IXO blockchain. If absent, a new one is created using the user's wallet mnemonic.

3. **Matrix Setup**
   - A Matrix account is either registered or logged into.
   - A secure Matrix room is created (if needed).
   - A **Matrix-specific mnemonic** is encrypted with a user-defined password and stored in the room’s state for later recovery.

---

### 🆕 Register Passkey

This method uses the WebAuthn (FIDO2) standard to register a passkey, enabling passwordless smart account authentication using biometric data or hardware tokens.

#### 🔁 Process Flow:

- Generate a **new IXO wallet** using a fresh mnemonic.
- Check or grant a **feegrant** for the new address.
- Register a **passkey** and add it to the wallet using `MsgAddAuthenticator`.
- Create and ledger a **DID document** for the wallet.
- Generate a **Matrix-specific mnemonic** (independent from wallet mnemonic).
- Register a new **Matrix account** using credentials derived from the Matrix mnemonic.
- Create a **personal Matrix room** and join it.
- Encrypt the Matrix mnemonic using the user’s password and store it in Matrix room state.

> 💡 _This flow is ideal for new users or demos. The Matrix mnemonic and wallet mnemonic are always kept separate._

---

### 🔐 Login with Passkey

This flow is used when a user already has a registered passkey and wants to log in securely.

#### 🔁 Process Flow:

- Fetch an **authentication challenge** from the server.
- Use `navigator.credentials.get()` to retrieve a passkey assertion.
- Determine **associated smart accounts** based on the passkey credential ID.
- Select the target account and verify:
  - **Feegrant** exists or is created.
  - **DID** exists on chain.
- Request and decrypt the stored **Matrix mnemonic** via the Matrix room bot.
- Use this to **login to Matrix**.

> 🔐 _The Matrix mnemonic is encrypted with a password only the user knows — this ensures recovery is secure._

---

### ✍️ Login with Mnemonic

This method allows logging in using a **raw mnemonic seed phrase**, ideal for developers or advanced users.

#### 🔁 Process Flow:

- Derive the wallet from the **entered mnemonic**.
- Check or grant a **feegrant** for the wallet address.
- Ensure a **DID document** is ledgered (create if not).
- Attempt to fetch the **Matrix mnemonic** from the Matrix bot using a signed challenge.
  - If not available, a **new Matrix account and room** are created.
- Decrypt the Matrix mnemonic using the user’s password.
- Login or register on Matrix with the derived credentials.

> 🧠 _This flow enables deterministic wallet access and Matrix account linkage based on a known mnemonic._

## 📊 Dashboard

Once logged in, users land on the **Dashboard**, which acts as the main interface for interacting with a specific **Claim Collection**.

The user must provide a valid numeric `collectionId` to begin. Once fetched, the dashboard reveals various tabs that allow the user to view or manage bids and claims related to that collection depending on their role.

---

### 🔎 Collection ID Search

At the top of the dashboard is a field to input the `collectionId`.

- Enter the ID and click **Search**
- If the collection exists, the dashboard will load tabs with associated claim and bid data
- If not found, an error is shown

Once a collection is successfully loaded, the app continuously checks the user's authorization status (admin, owner, agent) using:

- The collection admin field
- Protocol entity ownership
- Blockchain authz module grant data

---

### 🧑‍💼 Role Display

If the user has any roles, they will be displayed as labeled badges:

- `Collection Admin`
- `Collection Owner`
- `Service Agent` (SubmitClaimAuthorization)
- `Evaluation Agent` (EvaluateClaimAuthorization)

These roles affect what tabs the user sees or what actions they can take inside each tab.

---

### 🗂️ Tabs Overview

The dashboard has four main sections:

| Tab                   | Description                                                    | Required Role(s)                     |
| --------------------- | -------------------------------------------------------------- | ------------------------------------ |
| **My Bids**           | View and manage bids submitted by the currently logged-in user | Any logged-in user                   |
| **Collection Bids**   | View all bids submitted to the current collection              | `admin`, `owner`                     |
| **My Claims**         | View and manage claims submitted by the user                   | `Service Agent`                      |
| **Collection Claims** | View all claims submitted to the collection                    | `admin`, `owner`, `Evaluation Agent` |

---

### 📝 Signing Transactions

Actions inside the tabs (e.g., submitting a claim or granting authz) trigger blockchain transactions. These transactions are passed to the `onSign()` function provided via props and signed using the user's smart account (registered via passkey) or base account (mnemonic login).

## 📑 Bids

The **Bids** section revolves entirely around the **Matrix Bid Bot**, a service responsible for managing bids within the Matrix ecosystem.

> 🧠 All bids are **stored and managed in Matrix**, not on-chain.

Each claim collection's entity has a dedicated **Matrix room**, where the Bid Bot processes and tracks submitted bids. This room acts as the authoritative source of truth for bids, ensuring decentralized and flexible bid storage.

---

### 🔄 How it Works

- Users submit bids through a form rendered by the app.
- The bid is sent to the **Matrix Bid Bot**, which validates and stores it in the appropriate Matrix room.
- No blockchain transaction occurs at this stage — the bid exists **entirely off-chain**.

Only once a bid is **approved** by an admin or owner:

1. An **authz blockchain transaction** is signed and broadcast.
2. This grants the bidder a role (e.g. `Service Agent`, `Evaluation Agent`) via a `MsgGrantEntityAccountAuthz` transaction.
3. The Matrix Bid Bot is notified of the approval and marks the bid as accepted.

---

### 📦 Why Matrix?

This architecture offers:

- **Flexible bid formats** (via SurveyJS JSON forms)
- **Off-chain coordination** before incurring gas costs
- **Seamless integration with IXO's Matrix-based identity and permission system**

> 💡 Bids can be rotated, updated, or re-submitted without touching the blockchain — until a role is formally granted.

---

### 🧍 My Bids

**Role Required**: Any logged-in user  
**Component**: `MyBids`

This section allows a user to:

- View their existing bids submitted to the selected claim collection.
- Submit a **new bid** as either a:
  - `Service Agent (SA)`
  - `Evaluation Agent (EA)`

#### 🔁 Flow for Submitting a Bid:

1. **Click "New Bid"**
2. The app fetches the bid form template (a `SurveyJS` JSON schema) from the claim collection's offers and protocol entity.
3. The form is rendered inside a modal using SurveyJS.
4. The user selects their desired role (`SA` or `EA`) and submits the bid.
5. The bid is sent to the Matrix Bid Bot via the `submitBid()` endpoint.

> 🔐 The bid data is stored in Matrix and indexed by IXO’s custom Matrix bot infrastructure.

#### 🧾 Additional Features:

- View details of each bid (including role, date, DID, and JSON data).
- Only one bid can be active per user per collection.

---

### 🗃️ Collection Bids

**Role Required**: `admin` or `owner`  
**Component**: `CollectionBids`

This sectoin allows privileged users to:

- View **all bids** submitted to the claim collection.
- **Approve or reject** bids based on their content and associated role.

#### ✅ Approving a Bid:

When approving a bid, the app:

1. Creates an `MsgGrantEntityAccountAuthz` message to authorize the selected address as a Service or Evaluation Agent.
2. Defines constraints such as:
   - Agent quota
   - Max token payments
   - Validity duration
3. Sends the transaction using the `onSign()` callback.
4. Notifies the Matrix Bid Bot to **finalize approval** using `approveBid()`.

#### ❌ Rejecting a Bid:

1. Calls the `rejectBid()` method on the Bid Bot with an optional reason.
2. The bid becomes inactive.

#### 🧾 Additional Features:

- Modal UI to inspect bid metadata and raw JSON contents.
- Buttons to approve or reject depending on role.

> 🧠 **Service Agent (SA)** and **Evaluation Agent (EA)** roles have distinct grant types and constraints.

---

## 🧾 Claims

The **Claims** section revolves around submitting and evaluating **claims** made against a **Claim Collection**.

Unlike bids, **claims are recorded on-chain** through blockchain transactions.  
However, the **data associated with each claim** (such as the responses submitted) is stored privately inside the **collection's entity Matrix room**, managed by the **Matrix Claim Bot**.

---

### 🔄 How it Works

- A user submits a claim by completing a form (based on a SurveyJS template attached to the collection or protocol).
- The **claim data** is securely stored in the collection’s Matrix room using the **Matrix Claim Bot** and a cid gets provided in response.
- A blockchain transaction (`MsgSubmitClaim`) is executed, **linking the claim data** (via the CID) to the claim on the IXO chain.
- The full, sensitive claim details remain off-chain and accessible only via Matrix to authorized agents (e.g., evaluators).
- Evaluation (approval or rejection) of claims triggers a blockchain transaction (`MsgEvaluateClaim`).

> 🔐 **Private data access**: Only users authorized through the collection's authz permissions (e.g., Evaluation Agents) can access and view the full claim content.

---

### 🧩 Why This Approach?

This hybrid model ensures:

- **On-chain proof** of claim submissions.
- **Off-chain encryption** and privacy for sensitive information.
- **Efficient evaluation** processes without overloading blockchain storage.
- **Scalability** by keeping large or complex forms in Matrix.

---

## 🧍 My Claims

**Role Required**: `Service Agent`  
**Component**: `MyClaims`

This tab allows authenticated users who have been approved as Service Agents to:

- View a list of **claims** they have submitted to the currently selected claim collection.
- **Submit a new claim** by filling out a dynamic form (SurveyJS), which:
  - Saves the form data to Matrix (via the **Matrix Claim Bot**).
  - Broadcasts a blockchain transaction (`MsgSubmitClaim`) to register the claim on-chain.

### 🔁 Flow for Submitting a Claim:

1. User clicks **"New Claim"**.
2. The app fetches the form JSON from the claim collection's `#surveyTemplate` resource.
3. Form is displayed using **SurveyJS**.
4. Upon submission:
   - Claim data is stored in the Matrix room via the **Claim Bot**.
   - A blockchain transaction (`MsgSubmitClaim`) is executed.
5. The claim appears in the "My Claims" list with metadata like date, DID, and status.

> 📦 Claim form data (including survey answers) is **not stored on-chain** — only a reference (`claimId`) is committed to the chain.

---

## 🏛️ Collection Claims

**Role Required**: `admin`, `owner`, or `Evaluation Agent`  
**Component**: `CollectionClaims`

This tab allows privileged users to:

- View **all submitted claims** for the active claim collection.
- Access the full **claim data** for review (fetched securely from the Matrix room).
- Approve or reject claims by signing a transaction (`MsgEvaluateClaim`) on-chain.

### ✅ Evaluating a Claim:

1. Click **"View Claim"** to inspect full metadata and form data (fetched from Matrix).
2. If the user has evaluation rights:
   - Press **Approve** to execute `MsgEvaluateClaim` with status `APPROVED`.
   - Press **Reject** to execute `MsgEvaluateClaim` with status `REJECTED`.
3. Evaluation is broadcast via a signed transaction, updating the claim’s status on-chain.

> 🔐 Only users with explicit blockchain **authz grants** can evaluate claims. The Matrix data is decrypted and shown only to authorized roles.

---

### 💡 Notes

- Evaluation rights are enforced both by chain-side authz and Matrix access.
- Claims support rich data submission via customizable forms (SurveyJS).
- Matrix ensures scalability, security, and data privacy.

## ✅ Wrapping Up

This demo app showcases a fully functional flow for working with **IXO’s decentralized identity and claim infrastructure**, combining:

- 🔐 **Secure authentication** via **Passkeys** and **mnemonics**
- 🧾 **Bids and claims** backed by on-chain transactions
- 🛰️ **Matrix bots** for secure, off-chain data storage and coordination

By separating sensitive data from public blockchain records and leveraging Matrix as a decentralized communication and storage layer, this architecture achieves both **privacy** and **auditability**.

---

### 🧰 Next Steps

- Explore the [source code](#) to customize flows for your own claim collections and roles.

---

### 🙌 Thanks for Building on IXO

Together, we're enabling trusted impact through verifiable data, transparent processes, and open infrastructure.

Welcome to the future of public good tech.
