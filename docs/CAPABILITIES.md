<!--
  GENERATED FILE — DO NOT EDIT.
  Produced by scripts/gen-capabilities.ts from constants/stepCatalogue.ts.
  Run `yarn gen` after changing the catalogue; CI fails if this file is stale.
-->

# JAMBO capabilities

Every step a JAMBO action can be composed from, what it captures, and which chain
message it produces. Use this to decide whether a use-case can be expressed with
the steps that exist, or whether it needs a new one.

An **action** is a named sequence of steps, declared in `constants/config.json`
and routed at `/<action.id>`. Steps run in order; each captures data that later
steps read. Every action must end with a `review` or `external` step.

Step kinds:

- **input** — captures data. Cannot end an action.
- **review** — assembles and broadcasts a transaction. Ends an action.
- **external** — hands off to a third party and emits no chain message. Ends an action.

## Message support

JAMBO currently emits 8 message types, all `cosmos-sdk`.
There is no IBC transfer, no CosmWasm, no `gov/v1`, and no ixo-specific module
(entity, iid, claims, bonds, tokens) — so a use-case needing those needs a new
step and message builder first. See `docs/RECIPES.md`.

| Message                                                   | Step                                      |
| --------------------------------------------------------- | ----------------------------------------- |
| `/cosmos.bank.v1beta1.MsgSend`                            | `bank_MsgSend`                            |
| `/cosmos.bank.v1beta1.MsgMultiSend`                       | `bank_MsgMultiSend`                       |
| `/cosmos.staking.v1beta1.MsgDelegate`                     | `staking_MsgDelegate`                     |
| `/cosmos.staking.v1beta1.MsgUndelegate`                   | `staking_MsgUndelegate`                   |
| `/cosmos.staking.v1beta1.MsgBeginRedelegate`              | `staking_MsgRedelegate`                   |
| `/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward` | `distribution_MsgWithdrawDelegatorReward` |
| `/cosmos.gov.v1beta1.MsgVote`                             | `gov_MsgVote`                             |
| `/cosmos.gov.v1beta1.MsgSubmitProposal`                   | `gov_MsgSubmitProposal`                   |

## Review steps

#### `bank_MsgSend`

Review and sign a token transfer to a single recipient.

**Requires earlier in the action:** `get_receiver_address`, `select_token_and_amount`

**Emits:** `/cosmos.bank.v1beta1.MsgSend`

**Config:** none — supplying one is a config error, not a no-op.

**Used by:** Send

#### `bank_MsgMultiSend`

Review and sign a token transfer to several recipients in one transaction.

**Requires earlier in the action:** `get_receiver_address`, `select_token_and_amount`

**Emits:** `/cosmos.bank.v1beta1.MsgMultiSend`

**Config:** none — supplying one is a config error, not a no-op.

**Used by:** Multi Send

#### `staking_MsgDelegate`

Review and sign a delegation to a validator.

**Requires earlier in the action:** `get_validator_delegate`, `select_amount_delegate`

**Emits:** `/cosmos.staking.v1beta1.MsgDelegate`

**Config:** none — supplying one is a config error, not a no-op.

**Used by:** Delegate

#### `staking_MsgUndelegate`

Review and sign an undelegation from a validator.

**Requires earlier in the action:** `get_delegated_validator_undelegate`, `select_amount_undelegate`

**Emits:** `/cosmos.staking.v1beta1.MsgUndelegate`

**Config:** none — supplying one is a config error, not a no-op.

**Used by:** Undelegate

#### `staking_MsgRedelegate`

Review and sign a redelegation from one validator to another.

**Requires earlier in the action:** `get_delegated_validator_redelegate`, `select_amount_redelegate`, `get_validator_redelegate`

**Emits:** `/cosmos.staking.v1beta1.MsgBeginRedelegate`

**Config:** none — supplying one is a config error, not a no-op.

**Used by:** Redelegate

#### `distribution_MsgWithdrawDelegatorReward`

Review and sign a claim of all outstanding staking rewards. Needs no preceding step.

**Emits:** `/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward`

**Config:** none — supplying one is a config error, not a no-op.

**Used by:** Claim Rewards

#### `gov_MsgVote`

Review and sign a vote on a governance proposal.

**Requires earlier in the action:** `select_proposal`

**Emits:** `/cosmos.gov.v1beta1.MsgVote`

**Config:** none — supplying one is a config error, not a no-op.

**Used by:** Vote

#### `gov_MsgSubmitProposal`

Review and sign the submission of a new text proposal.

**Requires earlier in the action:** `define_proposal_title`, `define_proposal_description`, `define_proposal_deposit`

**Emits:** `/cosmos.gov.v1beta1.MsgSubmitProposal`

**Config:** none — supplying one is a config error, not a no-op.

**Used by:** Text Proposal

## Input steps

#### `get_receiver_address`

Capture one or more recipient addresses, by typing or QR scan.

**Config:** none — supplying one is a config error, not a no-op.

**Used by:** Send, Multi Send

#### `get_validator_delegate`

Pick any validator to delegate to.

**Config:** none — supplying one is a config error, not a no-op.

**Used by:** Delegate

#### `get_validator_redelegate`

Pick the destination validator to redelegate to. Excludes the source validator.

**Requires earlier in the action:** `get_delegated_validator_redelegate`

**Config:** none — supplying one is a config error, not a no-op.

**Used by:** Redelegate

#### `get_delegated_validator_undelegate`

Pick a validator the user has an existing delegation with, to undelegate from.

**Config:** none — supplying one is a config error, not a no-op.

**Used by:** Undelegate

#### `get_delegated_validator_redelegate`

Pick the source validator to redelegate away from.

**Config:** none — supplying one is a config error, not a no-op.

**Used by:** Redelegate

#### `select_token_and_amount`

Choose a token from the wallet balance and enter an amount.

**Config:**

| Field         | Type    | Required | Description                                           |
| ------------- | ------- | -------- | ----------------------------------------------------- |
| `optional`    | boolean | no       | Allow the user to continue without choosing an amount |
| `amountLabel` | string  | no       | Overrides the amount field label                      |
| `denomLabel`  | string  | no       | Overrides the token field label                       |

**Used by:** Send, Multi Send

#### `select_amount_delegate`

Enter the amount to delegate, bounded by the available balance.

**Requires earlier in the action:** `get_validator_delegate`

**Config:** none — supplying one is a config error, not a no-op.

**Used by:** Delegate

#### `select_amount_undelegate`

Enter the amount to undelegate, bounded by the existing delegation.

**Requires earlier in the action:** `get_delegated_validator_undelegate`

**Config:** none — supplying one is a config error, not a no-op.

**Used by:** Undelegate

#### `select_amount_redelegate`

Enter the amount to redelegate, bounded by the existing delegation.

**Requires earlier in the action:** `get_delegated_validator_redelegate`

**Config:** none — supplying one is a config error, not a no-op.

**Used by:** Redelegate

#### `select_proposal`

Choose an open governance proposal and a vote option.

**Config:** none — supplying one is a config error, not a no-op.

**Used by:** Vote

#### `define_proposal_title`

Enter a title for a new text proposal.

**Config:** none — supplying one is a config error, not a no-op.

**Used by:** Text Proposal

#### `define_proposal_description`

Enter a description for a new text proposal.

**Config:** none — supplying one is a config error, not a no-op.

**Used by:** Text Proposal

#### `define_proposal_deposit`

Choose the initial deposit token and amount for a new proposal.

**Config:** none — supplying one is a config error, not a no-op.

**Used by:** Text Proposal

## External steps

#### `kado_buy_crypto`

Open the Kado on-ramp so the user can buy crypto with fiat. Ends the action; emits no chain message.

**Config:** none — supplying one is a config error, not a no-op.

**Used by:** Buy

## Declared but not implemented

These ids exist in the `STEPS` enum but have no component wired into
`pages/[actionId].tsx`. `yarn validate:config` rejects any action referencing
them.

- `check_user_balance` — Not implemented — no component is wired up for this step id.
- `define_amount` — Not implemented — no component is wired up for this step id.
- `send_token_to_receiver` — Not implemented — no component is wired up for this step id.
- `review_and_sign` — Not implemented as a routable step — use a specific `*_Msg*` review step instead.

## Shipped actions

| Id                       | Name          | Steps                                                                                                                    |
| ------------------------ | ------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `kado`                   | Buy           | `kado_buy_crypto`                                                                                                        |
| `eKXPPhewkJDLbE1bq1iboz` | Send          | `select_token_and_amount` → `get_receiver_address` → `bank_MsgSend`                                                      |
| `eKXPPhewkJDLbE1bq1ib78` | Multi Send    | `select_token_and_amount` → `get_receiver_address` → `bank_MsgMultiSend`                                                 |
| `eKXPPhewkJDLbE1bq1iboa` | Delegate      | `get_validator_delegate` → `select_amount_delegate` → `staking_MsgDelegate`                                              |
| `eKXPPhewkJDLbE1bq1ibob` | Undelegate    | `get_delegated_validator_undelegate` → `select_amount_undelegate` → `staking_MsgUndelegate`                              |
| `eKXPPhewkJDLbE1bq1iboc` | Redelegate    | `get_delegated_validator_redelegate` → `select_amount_redelegate` → `get_validator_redelegate` → `staking_MsgRedelegate` |
| `eKXPPhewkJDLbE1bq1ibod` | Claim Rewards | `distribution_MsgWithdrawDelegatorReward`                                                                                |
| `eKXPPhewkJDLbE1bq1iboe` | Vote          | `select_proposal` → `gov_MsgVote`                                                                                        |
| `eKXPPhewkJDLbE1bq1ibof` | Text Proposal | `define_proposal_title` → `define_proposal_description` → `define_proposal_deposit` → `gov_MsgSubmitProposal`            |
