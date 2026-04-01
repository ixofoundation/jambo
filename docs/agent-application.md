# Agent Application (Bids)

To submit claims against a collection, a user must first be authorized as a **Service Agent**. Authorization is managed through an application (bid) system backed by the Matrix Bid Bot, with on-chain authz grants confirming the role.

## Overview

```
User applies as agent
  |
  v
SurveyJS application form (from protocol entity)
  |
  v
Bid submitted to Matrix Bid Bot (off-chain)
  |
  v
Admin/owner reviews and approves (external admin interface)
  |
  v
On-chain authz grant: SubmitClaimAuthorization
  |
  v
User can now submit claims
```

## Application Flow

1. **Eligibility check**: The collection detail screen checks if the user already has a `SubmitClaimAuthorization` grant or a pending bid. If neither, the "Apply as Agent" button is shown.

2. **Open form**: Clicking "Apply as Agent" fetches the application form template from the protocol entity's linked resource (`#surveyTemplate`, `#bco`, or `#vct`). The form is rendered using SurveyJS.

3. **Submit bid**: On form completion, the bid is sent to the Matrix Bid Bot:
   ```
   bidBotClient.bid.v1beta1.submitBid(collectionId, formData, 'SA', openIdToken, did)
   ```
   - `'SA'` indicates the user is applying as a **Service Agent**
   - The bid is stored entirely off-chain in Matrix

4. **Pending state**: After submission, the UI shows "Application pending -- Your agent application is being reviewed."

## Status Tracking

The dashboard checks authorization status for each collection in parallel:

1. **On-chain check**: Query `cosmos.authz.v1beta1.granteeGrants` for the user's address. Look for `SubmitClaimAuthorization` grants from the collection's admin, optionally scoped to the specific collection ID via constraints.

2. **Bid check**: If no on-chain grant exists, query the Bid Bot for existing bids: `bidBotClient.bid.v1beta1.queryBidsByDid(collectionId, did, openIdToken, did)`

3. **Result mapping**:
   - `agent` -- user has `SubmitClaimAuthorization` grant (shown as green badge)
   - `pending` -- user has a bid but no grant yet (shown as orange badge)
   - `unauthorized` -- no bid and no grant (no badge, "Apply as Agent" button available)

### Status in Collection Detail

The collection detail screen runs its own auth check (polling every 5 seconds via `checkAuthz()`):

- Checks for `SubmitClaimAuthorization` and `EvaluateClaimAuthorization` grants
- Also checks if the user is the collection admin or entity owner
- The authorization state drives which UI elements are shown:
  - `isAgent` (has SubmitClaimAuthorization) -- shows claims list + "New Claim" button
  - `hasPendingBid` -- shows "Application pending" banner
  - Neither -- shows "Apply as a service agent" prompt

## Approval Process

Bid approval is handled **externally** (not in this app's current UI):

1. An admin or owner reviews the bid in a separate admin interface
2. They sign an `MsgGrantEntityAccountAuthz` transaction granting `SubmitClaimAuthorization` to the applicant's address
3. The Bid Bot is notified of the approval
4. The next time the user's app checks authz (every 5 seconds in collection detail, or on dashboard load), the status updates to `agent`

## Date Restrictions

Agent applications follow the same date enforcement as claim submissions:

- If the collection's `endDate` has passed -- applications are blocked
- If the collection's `startDate` hasn't arrived -- applications are blocked
- The "Apply as Agent" button is hidden and replaced with the appropriate date message

## Key Files

| File | Purpose |
| --- | --- |
| `screens/collectionDetail.tsx` | `handleApplyAsAgent()`, bid form display, auth status |
| `screens/dashboard.tsx` | Per-collection status checking (`checkStatuses()`) |
| `@ixo/matrixclient-sdk` | `createMatrixBidBotClient()` for Bid Bot interactions |
| `constants/transaction.ts` | `SubmitClaimAuthorization` and `EvaluateClaimAuthorization` type URLs |
