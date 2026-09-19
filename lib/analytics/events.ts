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

export type EventRegistry = AuthEvents & YomaEvents & DeckEvents & ChatEvents & ClaimFlowEvents;

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
} as const);

/** Person properties set on identify(). Same keys as the portal. */
export type UserTraits = {
  name?: string;
  did?: string;
  address?: string;
  matrixUserId?: string;
  matrixHomeserver?: string;
};
