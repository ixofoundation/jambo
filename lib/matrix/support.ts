import type { MatrixClient, MatrixEvent, Room } from 'matrix-js-sdk';

import {
  SUPPORT_LAST_SEEN_STATE_EVENT_TYPE,
  SUPPORT_NEW_THREAD_PREAMBLE,
  SUPPORT_THREAD_LIST_CAP,
  SUPPORT_THREAD_PREVIEW_MAX,
  SUPPORT_THREAD_STATE_EVENT_TYPE,
} from '@constants/support';

export type SupportThreadEntry = {
  id: string;
  preview: string;
  createdAt: number;
};

// State-event shape: keyed by the support room id, value is an array of thread-root event ids.
// Only event IDs are persisted; preview/timestamp are re-derived by fetching the root events at
// display time so the list stays in sync with whatever's actually in the room.
type SupportThreadStateContent = {
  [supportRoomId: string]: string[];
};

export class SupportRoomNotProvisionedError extends Error {
  constructor(alias: string) {
    super(`Support room ${alias} is not yet provisioned`);
    this.name = 'SupportRoomNotProvisionedError';
  }
}

export function buildSupportRoomAlias(entityDid: string, homeserverName: string): string {
  const localpart = `${entityDid.replace(/:/g, '-')}-sup`;
  return `#${localpart}:${homeserverName}`;
}

export function buildSupportPreview(body: string): string {
  const single = body.replace(/\s+/g, ' ').trim();
  if (single.length <= SUPPORT_THREAD_PREVIEW_MAX) return single;
  return `${single.slice(0, SUPPORT_THREAD_PREVIEW_MAX - 1)}…`;
}

function isNotFoundError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { errcode?: string; httpStatus?: number; data?: { errcode?: string } };
  return e.errcode === 'M_NOT_FOUND' || e.data?.errcode === 'M_NOT_FOUND' || e.httpStatus === 404;
}

export async function resolveSupportRoom(mxClient: MatrixClient, alias: string): Promise<{ roomId: string }> {
  try {
    const res = await mxClient.getRoomIdForAlias(alias);
    return { roomId: res.room_id };
  } catch (err) {
    if (isNotFoundError(err)) {
      throw new SupportRoomNotProvisionedError(alias);
    }
    throw err;
  }
}

export async function ensureJoined(mxClient: MatrixClient, roomIdOrAlias: string): Promise<string> {
  const room = await mxClient.joinRoom(roomIdOrAlias);
  return room.roomId;
}

export async function postThreadRoot(mxClient: MatrixClient, roomId: string, body: string): Promise<string> {
  const res = await mxClient.sendEvent(roomId, 'm.room.message' as any, {
    msgtype: 'm.text',
    body,
  });
  return res.event_id;
}

export async function postThreadReply(
  mxClient: MatrixClient,
  roomId: string,
  rootId: string,
  fallbackInReplyToId: string,
  body: string,
): Promise<string> {
  const res = await mxClient.sendEvent(roomId, 'm.room.message' as any, {
    msgtype: 'm.text',
    body,
    'm.relates_to': {
      rel_type: 'm.thread',
      event_id: rootId,
      is_falling_back: true,
      'm.in_reply_to': { event_id: fallbackInReplyToId },
    },
  });
  return res.event_id;
}

export type RawThreadEvent = {
  event_id: string;
  sender: string;
  origin_server_ts: number;
  content: {
    msgtype?: string;
    body?: string;
    'm.relates_to'?: {
      rel_type?: string;
      event_id?: string;
    };
  };
  type: string;
  unsigned?: { redacted_because?: unknown };
};

async function authFetchJson(mxClient: MatrixClient, path: string): Promise<any> {
  const baseUrl = mxClient.baseUrl.replace(/\/$/, '');
  const accessToken = mxClient.getAccessToken();
  if (!accessToken) throw new Error('Matrix access token not available');
  const res = await fetch(`${baseUrl}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const err = new Error(`Matrix HTTP ${res.status}`) as Error & {
      httpStatus: number;
      errcode?: string;
    };
    err.httpStatus = res.status;
    try {
      const body = await res.json();
      err.errcode = body?.errcode;
    } catch {
      // ignore
    }
    throw err;
  }
  return res.json();
}

export async function fetchThreadRoot(mxClient: MatrixClient, roomId: string, rootId: string): Promise<RawThreadEvent> {
  return authFetchJson(
    mxClient,
    `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/event/${encodeURIComponent(rootId)}`,
  );
}

export async function fetchThreadReplies(
  mxClient: MatrixClient,
  roomId: string,
  rootId: string,
): Promise<RawThreadEvent[]> {
  const events: RawThreadEvent[] = [];
  let from: string | null = null;
  // Cap pagination at a sane upper bound to avoid runaway loops on huge threads.
  for (let i = 0; i < 10; i++) {
    const params = new URLSearchParams({ limit: '100' });
    if (from) params.set('from', from);
    const data = await authFetchJson(
      mxClient,
      `/_matrix/client/v1/rooms/${encodeURIComponent(roomId)}/relations/${encodeURIComponent(
        rootId,
      )}/m.thread?${params.toString()}`,
    );
    const chunk: RawThreadEvent[] = Array.isArray(data?.chunk) ? data.chunk : [];
    events.push(...chunk);
    if (!data?.next_batch || chunk.length === 0) break;
    from = data.next_batch;
  }
  // Relations come newest-first from the server; flip to chronological order.
  events.sort((a, b) => a.origin_server_ts - b.origin_server_ts);
  return events;
}

/**
 * Fetch only the latest reply in a thread (newest-first, limit 1). Used by the unread-detection
 * code path so we don't have to pull the full reply set just to compare timestamps.
 * Returns `null` when the thread has no replies (or the request fails benignly).
 */
export async function fetchLatestThreadReply(
  mxClient: MatrixClient,
  supportRoomId: string,
  rootId: string,
): Promise<RawThreadEvent | null> {
  const params = new URLSearchParams({ limit: '1' });
  const data = await authFetchJson(
    mxClient,
    `/_matrix/client/v1/rooms/${encodeURIComponent(supportRoomId)}/relations/${encodeURIComponent(
      rootId,
    )}/m.thread?${params.toString()}`,
  );
  const chunk: RawThreadEvent[] = Array.isArray(data?.chunk) ? data.chunk : [];
  return chunk[0] ?? null;
}

async function readSupportThreadsState(mxClient: MatrixClient, userRoomId: string): Promise<SupportThreadStateContent> {
  try {
    const content = await mxClient.getStateEvent(userRoomId, SUPPORT_THREAD_STATE_EVENT_TYPE, '');
    if (content && typeof content === 'object') {
      return content as SupportThreadStateContent;
    }
    return {};
  } catch (err) {
    if (isNotFoundError(err)) return {};
    throw err;
  }
}

export async function readSupportThreadIds(
  mxClient: MatrixClient,
  userRoomId: string,
  supportRoomId: string,
): Promise<string[]> {
  const state = await readSupportThreadsState(mxClient, userRoomId);
  const ids = state[supportRoomId];
  return Array.isArray(ids) ? ids : [];
}

async function writeSupportThreadsState(
  mxClient: MatrixClient,
  userRoomId: string,
  next: SupportThreadStateContent,
): Promise<void> {
  await mxClient.sendStateEvent(userRoomId, SUPPORT_THREAD_STATE_EVENT_TYPE as any, next, '');
}

export async function appendSupportThreadId(
  mxClient: MatrixClient,
  userRoomId: string,
  supportRoomId: string,
  eventId: string,
): Promise<string[]> {
  const state = await readSupportThreadsState(mxClient, userRoomId);
  const existing = Array.isArray(state[supportRoomId]) ? state[supportRoomId] : [];
  // De-dupe (shouldn't happen, defensive) and cap at the configured list size.
  const deduped = existing.filter((id) => id !== eventId);
  const nextIds = [eventId, ...deduped].slice(0, SUPPORT_THREAD_LIST_CAP);
  const nextState: SupportThreadStateContent = { ...state, [supportRoomId]: nextIds };
  await writeSupportThreadsState(mxClient, userRoomId, nextState);
  return nextIds;
}

export async function removeSupportThreadId(
  mxClient: MatrixClient,
  userRoomId: string,
  supportRoomId: string,
  eventId: string,
): Promise<string[]> {
  const state = await readSupportThreadsState(mxClient, userRoomId);
  const existing = Array.isArray(state[supportRoomId]) ? state[supportRoomId] : [];
  const nextIds = existing.filter((id) => id !== eventId);
  if (nextIds.length === existing.length) return existing;
  const nextState: SupportThreadStateContent = { ...state, [supportRoomId]: nextIds };
  await writeSupportThreadsState(mxClient, userRoomId, nextState);
  return nextIds;
}

// --- Last-seen markers ------------------------------------------------------
//
// Per-conversation timestamps stored in the user's own matrix room.
// State-event content shape:
//   {
//     [supportRoomId]: {
//       threads?: { [rootId]: ts },   // ts of latest event the user has "seen" in this thread
//       dms?: { [dmRoomId]: ts },     // ts of latest event the user has "seen" in this DM
//     }
//   }
// Used by the unread hook to compute per-conversation dots and an aggregate hasUnread.

export type SupportLastSeen = {
  threads: Record<string, number>;
  dms: Record<string, number>;
};

type SupportLastSeenEntry = { threads?: Record<string, number>; dms?: Record<string, number> };
type SupportLastSeenStateContent = { [supportRoomId: string]: SupportLastSeenEntry | number | undefined };

async function readSupportLastSeenState(
  mxClient: MatrixClient,
  userRoomId: string,
): Promise<SupportLastSeenStateContent> {
  try {
    const content = await mxClient.getStateEvent(userRoomId, SUPPORT_LAST_SEEN_STATE_EVENT_TYPE, '');
    if (content && typeof content === 'object') return content as SupportLastSeenStateContent;
    return {};
  } catch (err) {
    if (isNotFoundError(err)) return {};
    throw err;
  }
}

function entryFor(raw: SupportLastSeenEntry | number | undefined): SupportLastSeenEntry {
  // Ignore the legacy single-number shape — treat as "no per-conversation marks yet".
  if (!raw || typeof raw === 'number') return {};
  return raw;
}

export async function readSupportLastSeen(
  mxClient: MatrixClient,
  userRoomId: string,
  supportRoomId: string,
): Promise<SupportLastSeen> {
  const state = await readSupportLastSeenState(mxClient, userRoomId);
  const entry = entryFor(state[supportRoomId]);
  return {
    threads: entry.threads ?? {},
    dms: entry.dms ?? {},
  };
}

async function bumpSupportLastSeen(
  mxClient: MatrixClient,
  userRoomId: string,
  supportRoomId: string,
  bucket: 'threads' | 'dms',
  key: string,
  ts: number,
): Promise<void> {
  const state = await readSupportLastSeenState(mxClient, userRoomId);
  const entry = entryFor(state[supportRoomId]);
  const map = entry[bucket] ?? {};
  if ((map[key] ?? 0) >= ts) return; // Never regress — keep the higher value.
  const nextEntry: SupportLastSeenEntry = {
    ...entry,
    [bucket]: { ...map, [key]: ts },
  };
  const next: SupportLastSeenStateContent = { ...state, [supportRoomId]: nextEntry };
  await mxClient.sendStateEvent(userRoomId, SUPPORT_LAST_SEEN_STATE_EVENT_TYPE as any, next, '');
}

export function markSupportThreadSeen(
  mxClient: MatrixClient,
  userRoomId: string,
  supportRoomId: string,
  rootId: string,
  ts: number = Date.now(),
): Promise<void> {
  return bumpSupportLastSeen(mxClient, userRoomId, supportRoomId, 'threads', rootId, ts);
}

export function markSupportDmSeen(
  mxClient: MatrixClient,
  userRoomId: string,
  supportRoomId: string,
  dmRoomId: string,
  ts: number = Date.now(),
): Promise<void> {
  return bumpSupportLastSeen(mxClient, userRoomId, supportRoomId, 'dms', dmRoomId, ts);
}

// Heuristic markers we use to identify a "this is the injected privacy disclaimer" first
// paragraph — survives future wording tweaks to the preamble constant without requiring an
// exact-string match. The user's own message would have to start with one of these to be
// accidentally stripped, which is unlikely.
const SUPPORT_PREAMBLE_MARKERS = [/public support/i, /public room/i, /personal information/i, /personal details/i];

export function stripSupportPreamble(body: string): string {
  // Fast path — current preamble matches exactly.
  const exactPrefix = `${SUPPORT_NEW_THREAD_PREAMBLE}\n\n`;
  if (body.startsWith(exactPrefix)) return body.slice(exactPrefix.length);

  // Fallback: if the first paragraph (everything up to the first `\n\n`) starts with the warning
  // emoji or mentions one of the disclaimer keywords, drop it.
  const firstBreak = body.indexOf('\n\n');
  if (firstBreak === -1) return body;
  const head = body.slice(0, firstBreak);
  const looksLikePreamble = head.startsWith('⚠') || SUPPORT_PREAMBLE_MARKERS.some((re) => re.test(head));
  return looksLikePreamble ? body.slice(firstBreak + 2) : body;
}

/**
 * Hydrate a list of thread-root event IDs into displayable summaries by fetching each event.
 * IDs that fail to resolve (e.g. 404 redacted, network error) are filtered out and reported via
 * `missingIds` so callers can clean them up from state if desired.
 */
export async function fetchSupportThreadSummaries(
  mxClient: MatrixClient,
  supportRoomId: string,
  eventIds: string[],
): Promise<{ entries: SupportThreadEntry[]; missingIds: string[] }> {
  if (eventIds.length === 0) return { entries: [], missingIds: [] };
  const results = await Promise.all(
    eventIds.map(async (id) => {
      try {
        const ev = await fetchThreadRoot(mxClient, supportRoomId, id);
        return { id, ev };
      } catch (err) {
        const httpStatus = (err as { httpStatus?: number })?.httpStatus;
        if (httpStatus === 404) return { id, missing: true as const };
        // For non-404 errors we still skip this entry, but don't auto-remove from state — the
        // failure may be transient.
        console.warn('[support] failed to fetch root', id, err);
        return { id, missing: false as const, skipped: true as const };
      }
    }),
  );
  const entries: SupportThreadEntry[] = [];
  const missingIds: string[] = [];
  for (const r of results) {
    if ('ev' in r && r.ev) {
      const body = r.ev.content?.body ?? '';
      entries.push({
        id: r.id,
        preview: buildSupportPreview(stripSupportPreamble(body)),
        createdAt: r.ev.origin_server_ts,
      });
    } else if ('missing' in r && r.missing) {
      missingIds.push(r.id);
    }
  }
  return { entries, missingIds };
}

export function extractRawEvent(event: MatrixEvent): RawThreadEvent {
  return {
    event_id: event.getId() ?? '',
    sender: event.getSender() ?? '',
    origin_server_ts: event.getTs(),
    content: event.getContent() as RawThreadEvent['content'],
    type: event.getType(),
    unsigned: event.getUnsigned() as RawThreadEvent['unsigned'],
  };
}

export function isThreadReplyFor(event: RawThreadEvent, rootId: string): boolean {
  const rel = event.content?.['m.relates_to'];
  return rel?.rel_type === 'm.thread' && rel?.event_id === rootId;
}

// ---------------------------------------------------------------------------
// Direct-message support
//
// Admins/support staff of an entity's support room can also reach a user via
// a 1:1 DM (encrypted). Three things happen for DMs:
//   1. Discover who counts as a support admin (PL >= 100 in the support room).
//   2. Auto-accept pending invites where the inviter is one of those admins.
//   3. List 1:1 DM rooms with those admins so the UI can offer them as chats.
// ---------------------------------------------------------------------------

export type SupportDmRoom = { roomId: string; adminUserId: string };

const SUPPORT_ADMIN_PL_THRESHOLD = 100;
const APPSERVICE_BOT_PL = 9999;

export async function fetchSupportAdminUserIds(mxClient: MatrixClient, supportRoomId: string): Promise<Set<string>> {
  console.log('fetchSupportAdminUserIds::supportRoomId', supportRoomId);
  let plContent: unknown;
  try {
    plContent = await mxClient.getStateEvent(supportRoomId, 'm.room.power_levels' as any, '');
    console.log('fetchSupportAdminUserIds::plContent', plContent);
  } catch (err) {
    if (isNotFoundError(err)) return new Set();
    throw err;
  }
  const users = ((plContent as { users?: Record<string, number | string> })?.users ?? {}) as Record<
    string,
    number | string
  >;
  const admins = new Set<string>();
  for (const [userId, level] of Object.entries(users)) {
    const pl = typeof level === 'number' ? level : Number(level);
    if (Number.isFinite(pl) && pl >= SUPPORT_ADMIN_PL_THRESHOLD && pl < APPSERVICE_BOT_PL) {
      admins.add(userId);
    }
  }
  console.log('fetchSupportAdminUserIds::admins', admins);
  return admins;
}

// Returns rooms where the user has a pending invite from one of the support admins.
// These are NOT auto-accepted; the UI surfaces them as pending invites so the user
// can review who's inviting them and the room's encryption status before joining.
export function findPendingDmInvitesFromAdmins(
  mxClient: MatrixClient,
  adminUserIds: Set<string>,
): SupportDmRoom[] {
  if (adminUserIds.size === 0) return [];
  const ownUserId = mxClient.getUserId();
  if (!ownUserId) return [];
  const rooms = mxClient.getRooms() as Array<Room & { getMyMembership?: () => string }>;
  const result: SupportDmRoom[] = [];
  for (const room of rooms) {
    try {
      if (typeof (room as any).getMyMembership !== 'function') continue;
      if ((room as any).getMyMembership() !== 'invite') continue;
      const myMember = room.getMember(ownUserId) as any;
      const inviter: string | undefined = myMember?.events?.member?.getSender?.();
      if (!inviter || !adminUserIds.has(inviter)) continue;
      result.push({ roomId: room.roomId, adminUserId: inviter });
    } catch (err) {
      console.warn('[support] failed to inspect DM invite', (room as any)?.roomId, err);
    }
  }
  return result;
}

export async function acceptDmInvite(mxClient: MatrixClient, roomId: string): Promise<void> {
  await mxClient.joinRoom(roomId);
}

export async function rejectDmInvite(mxClient: MatrixClient, roomId: string): Promise<void> {
  await mxClient.leave(roomId);
}

// Best-effort check of whether the room has been configured for end-to-end encryption.
// Returns true when an `m.room.encryption` state event is present.
export function isRoomEncrypted(mxClient: MatrixClient, roomId: string): boolean {
  try {
    const room = mxClient.getRoom(roomId);
    if (!room) return false;
    const sdkSays = (room as any).hasEncryptionStateEvent?.();
    if (typeof sdkSays === 'boolean') return sdkSays;
    const isEncryptedFn = (room as any).currentState?.getStateEvents?.bind((room as any).currentState);
    if (typeof isEncryptedFn === 'function') {
      const event = isEncryptedFn('m.room.encryption', '');
      return !!event;
    }
  } catch (err) {
    console.warn('[support] failed to inspect room encryption', roomId, err);
  }
  return false;
}

export function findJoinedDmsWithAdmins(mxClient: MatrixClient, adminUserIds: Set<string>): SupportDmRoom[] {
  console.log('findJoinedDmsWithAdmins', adminUserIds);
  if (adminUserIds.size === 0) return [];
  const ownUserId = mxClient.getUserId();
  if (!ownUserId) return [];
  const rooms = mxClient.getRooms() as Array<Room & { getMyMembership?: () => string }>;
  const result: SupportDmRoom[] = [];
  for (const room of rooms) {
    if (typeof (room as any).getMyMembership !== 'function') continue;
    if ((room as any).getMyMembership() !== 'join') continue;
    const joined = ((room as any).getJoinedMembers?.() ?? []) as Array<{ userId: string }>;
    const others = joined.filter((m) => m.userId !== ownUserId);
    // Exactly one other joined member and that member is an admin → it's a 1:1 admin DM.
    if (others.length !== 1) continue;
    const other = others[0];
    if (!adminUserIds.has(other.userId)) continue;
    result.push({ roomId: room.roomId, adminUserId: other.userId });
  }
  return result;
}

export type RawDmMessage = {
  event_id: string;
  sender: string;
  origin_server_ts: number;
  body: string;
  status: 'ok' | 'encrypted';
};

export function readDmMessagesFromRoom(mxClient: MatrixClient, roomId: string): RawDmMessage[] {
  const room = mxClient.getRoom(roomId);
  if (!room) return [];
  const events = (room as any).getLiveTimeline?.()?.getEvents?.() ?? [];
  return (events as MatrixEvent[])
    .filter((e) => {
      const t = e.getType();
      return t === 'm.room.message' || t === 'm.room.encrypted';
    })
    .map((e) => {
      const t = e.getType();
      if (t === 'm.room.encrypted') {
        return {
          event_id: e.getId() ?? '',
          sender: e.getSender() ?? '',
          origin_server_ts: e.getTs(),
          body: '(decrypting…)',
          status: 'encrypted' as const,
        };
      }
      const content = e.getContent() as { body?: string };
      return {
        event_id: e.getId() ?? '',
        sender: e.getSender() ?? '',
        origin_server_ts: e.getTs(),
        body: content?.body ?? '',
        status: 'ok' as const,
      };
    });
}

export async function sendDmMessage(mxClient: MatrixClient, roomId: string, body: string): Promise<string> {
  const res = await mxClient.sendEvent(roomId, 'm.room.message' as any, {
    msgtype: 'm.text',
    body,
  });
  return res.event_id;
}
