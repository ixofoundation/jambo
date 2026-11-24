/**
 * Typed catalogue of product-analytics events.
 *
 * Event names and property shapes mirror the portal (impacts-x-web
 * `lib/analytics/events.ts`) wherever the meaning is the same, so the shared
 * PostHog project's existing dashboards pick up JAMBO traffic without new
 * tiles. JAMBO-only events follow the same snake_case convention.
 *
 * Every event is additionally stamped with the `app` / `brand` / `environment`
 * super properties registered in `./client.ts`, and — when signed in — with
 * `userDid` / `userAddress` / `userName` / `userMatrixId` read at capture time.
 */

export type AuthEvents = {
  /** One completed auth-hub code exchange. `place` mirrors the portal's value for hub logins. */
  user_logged_in: { place: 'auth hub callback' };
  user_logged_out: undefined;
  /** A still-valid session was revived from storage on app start (not a fresh login). */
  session_restored: undefined;
  /** First-time Matrix ("Data Store") login + encryption bootstrap finished after a fresh login. */
  vault_setup_completed: undefined;
};

export type YomaEvents = {
  /** The Yoma hand-off marker matched the account's linked Yoma profile. */
  yoma_account_linked: undefined;
  /** The hand-off marker did NOT match — the wrong-account prompt was shown. */
  yoma_account_mismatch_shown: undefined;
};

export type DeckEvents = {
  opportunity_saved: { entityDid: string };
  opportunity_skipped: { entityDid: string };
};

export type ChatMessageContentType = 'text' | 'reply';

export type ChatEvents = {
  chat_room_entered: { roomId: string };
  chat_message_sent: { roomId: string; contentType: ChatMessageContentType; lengthChars?: number };
};

/** Portal uses 'claim-submission' / 'bid-submission'; JAMBO adds evaluation. */
export type ClaimFlowType = 'claim-submission' | 'claim-evaluation';

export type ClaimFlowProps = {
  flowType: ClaimFlowType;
  entityDid: string;
  collectionId: string;
  claimId?: string;
};

export type ClaimFlowEvents = {
  editor_flow_submission_attempted: ClaimFlowProps;
  editor_flow_submitted: ClaimFlowProps & { claimId: string };
  editor_flow_submission_failed: ClaimFlowProps & { reason: string };
};

/** Where in the airtime swap something happened. */
export type AirtimeSwapStage = 'request' | 'burn' | 'redeem' | 'read';

/**
 * The airtime swap (docs/airtime-swap.md). Amounts are whole rands. Never the
 * PIN, the swap's reference or id, or a transaction hash.
 */
export type AirtimeSwapEvents = {
  /** The user confirmed an amount and the swap was asked for. */
  airtime_swap_started: { amountZar: number };
  /** The burn was signed and sent (its outcome may still be unknown). */
  airtime_swap_burn_sent: { amountZar: number };
  /** The PIN was issued and shown. `test` = a test PIN, not real airtime. */
  airtime_swap_completed: { amountZar: number; test: boolean };
  /** The burn is verified and the PIN is not issued yet. */
  airtime_swap_owed: { amountZar: number };
  /** The service flagged the swap for an operator. */
  airtime_swap_flagged: { amountZar: number };
  /** A refusal was shown. `code` is the service's error code, or a local one. */
  airtime_swap_refused: { stage: AirtimeSwapStage; code: string };
  /** A PIN of an earlier swap was read again. */
  airtime_pin_viewed: undefined;
};

/** Where the install offer was shown and on what kind of phone (docs/pwa.md). */
export type PwaInstallPlatform = 'android' | 'ios';
export type PwaInstallTrigger = 'claim_submitted' | 'profile';

/**
 * The installable app (docs/pwa.md). Every event also carries the
 * `display_mode` super property: 'standalone' when opened from the home screen.
 */
export type PwaEvents = {
  /** The install sheet was shown. */
  pwa_install_prompt_shown: { platform: PwaInstallPlatform; trigger: PwaInstallTrigger };
  /** Android: the answer to the browser's install dialog. iOS has no dialog, only instructions. */
  pwa_install_prompt_result: { outcome: 'accepted' | 'dismissed' };
  /** The user closed the install sheet with "Not now". */
  pwa_install_prompt_dismissed: { platform: PwaInstallPlatform; trigger: PwaInstallTrigger };
  /** The browser reports the app was installed (Android / desktop Chrome only). */
  pwa_installed: undefined;
  /** The user tapped "Update" on the new-version toast. */
  pwa_update_accepted: undefined;
};

export type EventRegistry = AuthEvents &
  YomaEvents &
  DeckEvents &
  ChatEvents &
  ClaimFlowEvents &
  AirtimeSwapEvents &
  PwaEvents;

export type TrackingEvent = keyof EventRegistry;

export type TrackingProps<E extends TrackingEvent> = EventRegistry[E];

/** Keeps the literal key types while enforcing that every value is a registered event name. */
function defineEventNames<T extends Record<string, TrackingEvent>>(names: T): T {
  return names;
}

export const AnalyticsEvents = defineEventNames({
  UserLoggedIn: 'user_logged_in',
  UserLoggedOut: 'user_logged_out',
  SessionRestored: 'session_restored',
  VaultSetupCompleted: 'vault_setup_completed',
  YomaAccountLinked: 'yoma_account_linked',
  YomaAccountMismatchShown: 'yoma_account_mismatch_shown',
  OpportunitySaved: 'opportunity_saved',
  OpportunitySkipped: 'opportunity_skipped',
  ChatRoomEntered: 'chat_room_entered',
  ChatMessageSent: 'chat_message_sent',
  EditorFlowSubmissionAttempted: 'editor_flow_submission_attempted',
  EditorFlowSubmitted: 'editor_flow_submitted',
  EditorFlowSubmissionFailed: 'editor_flow_submission_failed',
  AirtimeSwapStarted: 'airtime_swap_started',
  AirtimeSwapBurnSent: 'airtime_swap_burn_sent',
  AirtimeSwapCompleted: 'airtime_swap_completed',
  AirtimeSwapOwed: 'airtime_swap_owed',
  AirtimeSwapFlagged: 'airtime_swap_flagged',
  AirtimeSwapRefused: 'airtime_swap_refused',
  AirtimePinViewed: 'airtime_pin_viewed',
  PwaInstallPromptShown: 'pwa_install_prompt_shown',
  PwaInstallPromptResult: 'pwa_install_prompt_result',
  PwaInstallPromptDismissed: 'pwa_install_prompt_dismissed',
  PwaInstalled: 'pwa_installed',
  PwaUpdateAccepted: 'pwa_update_accepted',
} as const);

/** Person properties set on identify(). Same keys as the portal. */
export type UserTraits = {
  name?: string;
  did?: string;
  address?: string;
  matrixUserId?: string;
  matrixHomeserver?: string;
};
