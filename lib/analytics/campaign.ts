/**
 * Campaign (UTM) attribution that survives JAMBO's redirects.
 *
 * Partners such as SA Youth link to JAMBO with `utm_*` query parameters so
 * sign-ups can be traced back to the placement. posthog-js reads those from
 * the URL itself, but only from the URL it sees once it has loaded — and by
 * then the parameters are usually gone:
 *
 *  - a logged-out visitor on any guarded page (`/`, a Yoma hand-off deep link)
 *    is `router.replace`d to `/auth` before the lazy-loaded SDK starts;
 *  - consent may only be given later, after the URL has changed;
 *  - sign-in is a full-page round trip to the auth hub and back to
 *    `/auth/callback?code=…`, and a signed-in visitor on `/auth` is sent on
 *    with `location.replace`.
 *
 * So the parameters are snapshotted synchronously when the app module first
 * evaluates (before any redirect) into sessionStorage, which outlives the
 * same-tab auth-hub round trip, and `lib/analytics/client.ts` applies them
 * once PostHog runs. The snapshot is local only: nothing leaves the browser
 * unless the user accepts the consent banner. Campaign tags describe the link,
 * not the person, so they are not personal data.
 */

const KEY = 'ixo_landing_campaign';
// A campaign link clicked yesterday should not label today's unrelated visit.
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
// Values come from a URL anyone can craft — keep them short.
const MAX_VALUE_LENGTH = 200;

export const CAMPAIGN_PARAM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const;

export type CampaignParamKey = (typeof CAMPAIGN_PARAM_KEYS)[number];
export type CampaignParams = Partial<Record<CampaignParamKey, string>>;

export interface LandingCampaign {
  params: CampaignParams;
  /** Path the visitor first landed on with the tags, without its query. */
  landingPath: string;
}

/** The `utm_*` values in a query string; null when it carries none. */
export function readCampaignParams(search: string): CampaignParams | null {
  const query = new URLSearchParams(search);
  const params: CampaignParams = {};
  for (const key of CAMPAIGN_PARAM_KEYS) {
    const value = query.get(key)?.trim();
    if (value) params[key] = value.slice(0, MAX_VALUE_LENGTH);
  }
  return Object.keys(params).length > 0 ? params : null;
}

/**
 * Snapshots the current URL's campaign tags. Call once, at module scope in
 * `_app`, so it runs before any guard redirects. A newer tagged landing in the
 * same tab replaces the previous one (last touch per tab); an untagged page
 * load leaves the snapshot alone.
 */
export function captureLandingCampaign(): void {
  if (typeof window === 'undefined') return;
  const params = readCampaignParams(window.location.search);
  if (!params) return;
  try {
    window.sessionStorage.setItem(
      KEY,
      JSON.stringify({ params, landingPath: window.location.pathname, ts: Date.now() }),
    );
  } catch {
    // Storage unavailable (private mode etc.) — PostHog still sees the tags
    // when it loads on the landing URL itself.
  }
}

/** The snapshot for this tab; null when absent, expired, or invalid. */
export function peekLandingCampaign(): LandingCampaign | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { params?: unknown; landingPath?: unknown; ts?: unknown };
    if (typeof parsed.ts !== 'number' || Date.now() - parsed.ts > MAX_AGE_MS) {
      window.sessionStorage.removeItem(KEY);
      return null;
    }
    if (!parsed.params || typeof parsed.params !== 'object') return null;
    // Re-validate through the URL parser: sessionStorage is writable by
    // anything running on this origin.
    const params = readCampaignParams(
      new URLSearchParams(
        Object.entries(parsed.params as Record<string, unknown>).filter(
          (entry): entry is [string, string] => typeof entry[1] === 'string',
        ),
      ).toString(),
    );
    if (!params) return null;
    return { params, landingPath: typeof parsed.landingPath === 'string' ? parsed.landingPath : '' };
  } catch {
    return null;
  }
}

/** Drops the snapshot. Called on logout so a shared device starts clean. */
export function clearLandingCampaign(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    // Storage unavailable — nothing to clear.
  }
}

/**
 * First-touch person properties for identify()'s `$set_once`. Own names
 * rather than PostHog's `$initial_utm_*`: the SDK derives those from the first
 * URL it saw, which after a guard redirect is the untagged `/auth`.
 */
export function campaignFirstTouchProperties(campaign: LandingCampaign): Record<string, string> {
  const props: Record<string, string> = {};
  for (const [key, value] of Object.entries(campaign.params)) {
    props[`first_touch_${key}`] = value;
  }
  if (campaign.landingPath) props.first_touch_landing_path = campaign.landingPath;
  return props;
}

/**
 * Removes campaign tags from an internal path. The deep link saved for after
 * sign-in must not replay them — the snapshot already holds them — and
 * `/?utm_source=…` should count as the home default, not as a deep link.
 */
export function stripCampaignParams(path: string): string {
  const hashIndex = path.indexOf('#');
  const hash = hashIndex >= 0 ? path.slice(hashIndex) : '';
  const beforeHash = hashIndex >= 0 ? path.slice(0, hashIndex) : path;
  const queryIndex = beforeHash.indexOf('?');
  if (queryIndex < 0) return path;
  const pathname = beforeHash.slice(0, queryIndex);
  const query = new URLSearchParams(beforeHash.slice(queryIndex + 1));
  for (const key of CAMPAIGN_PARAM_KEYS) query.delete(key);
  const rest = query.toString();
  return `${pathname}${rest ? `?${rest}` : ''}${hash}`;
}
