# Product analytics (PostHog)

JAMBO reports product analytics to the **same PostHog project as the portal**
(impacts-x-web), using the same wrapper design, event names and identity model,
so the portal's existing dashboards include JAMBO traffic and can be split per
app.

## How it is gated

Nothing is captured unless all three hold (`lib/analytics/client.ts`):

1. `NEXT_PUBLIC_POSTHOG_KEY` is set for the build.
2. `NEXT_PUBLIC_CHAIN_NETWORK` is `mainnet`, or `NEXT_PUBLIC_POSTHOG_FORCE_ENABLE=true`
   (local / staging debugging only).
3. The user accepted the consent banner (`components/Analytics/AnalyticsConsentBanner.tsx`).
   The decision is stored in localStorage and a first-party cookie
   (`lib/analytics/consent.ts`); it survives logout. There is no settings toggle
   yet — same as the portal today.

posthog-js is lazy-loaded only once all three are true, so it never ships in
first-load JS. Autocapture and session recording are off: JAMBO keeps key
material in obfuscated localStorage and the SDK must never read the DOM or
storage.

## Transport

The browser posts to the same-origin path `/ingest`, which the `rewrites` in
`vercel.json` forward to PostHog (per PostHog's Vercel guide; the app deploys
on Vercel, `netlify.toml` is legacy). Next 12 may 308-redirect the SDK's
trailing-slash paths (`/ingest/e/` → `/ingest/e`) before the rewrite; PostHog
accepts both forms. `next dev` has no proxy, so set
`NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com` when debugging locally.

Production on Vercel (`jambo-yoma-v2`, IXO World team) has
`NEXT_PUBLIC_POSTHOG_KEY` set and `NEXT_PUBLIC_CHAIN_NETWORK=mainnet`, so
capture starts with the first production deploy of this code, after consent.

## Identity

- `distinct_id` is the user's DID (`did:ixo:<address>`), the same value the
  portal uses, so a person who uses both apps is one PostHog person.
- Person traits on identify: `name`, `did`, `address`, `matrixUserId`,
  `matrixHomeserver` (portal keys). Email is never sent.
- Identify runs on login (`providers/auth.tsx` `loginWithAuthHub`), on session
  revival, and whenever a signed-in user accepts the banner
  (`components/Analytics/AnalyticsIdentitySync.tsx`).
- `clearAllState()` in the auth provider calls `resetAnalytics()`, so logout
  forgets the person.
- Every event also carries `userDid`, `userAddress`, `userName`, `userMatrixId`
  read from Redux at capture time (portal convention).

## Splitting the shared project

Every event is stamped with super properties (`ANALYTICS_SUPER_PROPERTIES`):

| property      | value                                |
| ------------- | ------------------------------------ |
| `app`         | `jambo`                              |
| `brand`       | `yoma`                               |
| `environment` | `mainnet` / `testnet` / `devnet`     |

Filter or break down any dashboard by `app` to separate JAMBO from the portal.
PostHog also adds `$host`, `$current_url`, `$referrer` etc. automatically.

PostHog's `reset()` wipes registered super properties, so `resetAnalytics()`
re-registers them immediately; otherwise the events captured between logout
and the navigation to `/auth` would go out untagged.

## Events (`lib/analytics/events.ts`)

Names are snake_case. Where the meaning matches the portal, the name and
properties are identical so shared tiles pick JAMBO up without changes.

| event                                   | fired at                                                                 | properties                                         |
| --------------------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------- |
| `$pageview` / `$pageleave`              | SDK, on every route change                                               | SDK defaults                                       |
| `user_logged_in`                        | `loginWithAuthHub` after the auth-hub code exchange                      | `place: "auth hub callback"` (portal value)        |
| `session_restored`                      | session revived from storage on boot (not the boot right after login)    | –                                                  |
| `user_logged_out`                       | `logout()` before state is cleared                                       | –                                                  |
| `vault_setup_completed`                 | first Matrix login + encryption bootstrap after a fresh login            | –                                                  |
| `yoma_account_linked`                   | hand-off marker matched the linked Yoma profile                          | –                                                  |
| `yoma_account_mismatch_shown`           | hand-off marker did not match; wrong-account prompt shown                | –                                                  |
| `opportunity_saved` / `opportunity_skipped` | deck swipe                                                           | `entityDid`                                        |
| `chat_room_entered`                     | support DM or thread opened                                              | `roomId`                                           |
| `chat_message_sent`                     | support DM / thread reply / new thread sent                              | `roomId`, `contentType: text\|reply`, `lengthChars` |
| `editor_flow_submission_attempted`      | claim submit or evaluate started                                         | `flowType`, `entityDid`, `collectionId`, `claimId?` |
| `editor_flow_submitted`                 | on-chain claim submit / evaluate succeeded                               | same + `claimId`                                   |
| `editor_flow_submission_failed`         | claim submit / evaluate threw                                            | same + `reason`                                    |

`flowType` is `claim-submission` (portal value) or `claim-evaluation` (JAMBO
only). Bid applications and the KYC form do not report.

Registration is **not** tracked: the auth hub does not tell JAMBO whether an
account is new. If that is ever needed it belongs in the auth hub.

## Adding an event

1. Add the name and its property type to `EventRegistry` and `AnalyticsEvents`
   in `lib/analytics/events.ts`.
2. Call `track(AnalyticsEvents.X, props)` from `lib/analytics/client.ts` at the
   moment the action has succeeded. `track` is a no-op while analytics is off.
3. Never pass mnemonics, tokens, emails or message content as properties.
