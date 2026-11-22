export type SupportPromptKey = 'kyc';

// Curated quick-message sets keyed by a short identifier passed through the URL
// (`?prompts=<key>`). Unknown / missing keys → no quick options, only the free-form
// "write your own message" path renders.
export const SUPPORT_QUICK_MESSAGES_BY_PROMPT: Record<SupportPromptKey, readonly string[]> = {
  // Identity check (Self). The key stays 'kyc': it is what `?prompts=` links carry.
  kyc: [
    "I can't open the identity check link.",
    "My identity check didn't pass. Could you help me understand why?",
    'My identity check has been under review for a long time.',
    "I finished the identity check, but I'm not showing as verified.",
  ],
};

export const SUPPORT_PRIVACY_NOTICE =
  'This room is public — anyone on the homeserver can read it. Do not share personal information (ID numbers, addresses, document contents) here. For anything private, ask a support agent to start a direct message.';

// Short alert shown only in the selector views (list / new-conversation flows). Kept distinct
// from the preamble injected into thread roots so the user sees the warning twice in slightly
// different words — once before they send, once embedded in what they sent.
export const SUPPORT_INLINE_ALERT = "Public support — please don't share any personal information or documents.";

// Prepended to the FIRST message of a new support thread (the thread root only — not replies).
// Visible to both the user and any support agent inside the thread, reminding everyone that
// the room is public and sensitive details belong in a DM.
export const SUPPORT_NEW_THREAD_PREAMBLE =
  '⚠️ This is a public support thread - please do not share any personal information (IDs, addresses, document contents) here. If sensitive information needs to be shared, a support agent can open a direct message, but keep all general discussion and updates related to this support issue in this thread..';

export const SUPPORT_THREAD_STATE_EVENT_TYPE = 'ixo.support.threads';

// Per-support-room "last time the user dismissed the modal" timestamp, stored in the user's
// own matrix room. Used to compute an unread-message dot on the support button.
export const SUPPORT_LAST_SEEN_STATE_EVENT_TYPE = 'ixo.support.last_seen';

export const SUPPORT_THREAD_PREVIEW_MAX = 80;

export const SUPPORT_THREAD_LIST_CAP = 10;
