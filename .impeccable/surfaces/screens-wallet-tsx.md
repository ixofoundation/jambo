---
version: 1
slug: "screens-wallet-tsx"
primary_target: "screens/wallet.tsx"
related_targets: ["pages/wallet/index.tsx"]
---

Scope: the Wallet tab ("/wallet" → screens/wallet.tsx). Visitor mode: Operate (check money, move money).

Audience & job: a youth checking what they've earned and cashing out. Actions: Withdraw (→ /profile/offramp, YellowCard) and Deposit (→ /profile/onramp); Receive = copy the real ixo account address.

Content & proof: the balance is the user's REAL on-chain USDC (utils/usdcBalance.ts); "Cash · paid by organisations" is the only earnings row because it is the only real earning source today.

Constraints & deliberate omissions: the prototype's Activity feed, YoYo/Zlato earning rows, rewards-waiting row, Share flow, and Visa card are NOT built — no real data source backs them yet (no per-user payout history endpoint; no reward tokens in this deployment). When a real transaction-history source exists (blocksync tx-by-address or YellowCard payout history), the Activity section returns using the prototype's status-item grammar. Never fabricate history.

Chosen direction: prototype wallet grammar — white balance card with 42px Nunito-800 sum, green pill primary action + ghost secondary, earnings status-items with tinted icon chips.

Unresolved: activity feed data source; multi-token earnings when EDU/IXO rewards ship.
