import { useEffect, useState } from 'react';
import type { MatrixClient, MatrixEvent, Room } from 'matrix-js-sdk';

import {
  SupportDmRoom,
  SupportThreadEntry,
  fetchLatestThreadReply,
} from 'lib/matrix/support';

export type SupportUnreadMaps = {
  threads: Record<string, boolean>;
  dms: Record<string, boolean>;
  any: boolean;
};

const EMPTY_RESULT: SupportUnreadMaps = { threads: {}, dms: {}, any: false };

type UseSupportUnreadArgs = {
  mxClient: MatrixClient | null;
  supportRoomId: string;
  ownerUserId: string;
  threads: SupportThreadEntry[];
  dmRooms: SupportDmRoom[];
  threadLastSeen: Record<string, number>;
  dmLastSeen: Record<string, number>;
};

/**
 * Compute per-conversation unread booleans for the support modal.
 *
 * - **DMs** use the in-memory live timeline (sync already provides it — no HTTP).
 * - **Threads** fetch the latest reply per persisted thread (one cheap HTTP call each, capped at
 *   the thread-list size — typically <= 10).
 *
 * Also subscribes to `Room.timeline` so any new foreign message updates the relevant slot live.
 */
export function useSupportUnread({
  mxClient,
  supportRoomId,
  ownerUserId,
  threads,
  dmRooms,
  threadLastSeen,
  dmLastSeen,
}: UseSupportUnreadArgs): SupportUnreadMaps {
  const [result, setResult] = useState<SupportUnreadMaps>(EMPTY_RESULT);

  // -------- Compute on dependency change --------
  useEffect(() => {
    if (!mxClient || !supportRoomId || !ownerUserId) {
      setResult(EMPTY_RESULT);
      return;
    }
    let cancelled = false;

    const dmMap = computeDmUnread(mxClient, dmRooms, ownerUserId, dmLastSeen);
    const threadMap: Record<string, boolean> = {};
    setResult({ threads: threadMap, dms: dmMap, any: Object.values(dmMap).some(Boolean) });

    (async () => {
      for (const t of threads) {
        if (cancelled) return;
        const since = threadLastSeen[t.id] ?? 0;
        try {
          const latest = await fetchLatestThreadReply(mxClient, supportRoomId, t.id);
          if (cancelled) return;
          const isUnread = !!latest && latest.sender !== ownerUserId && latest.origin_server_ts > since;
          if (!isUnread) continue;
          setResult((prev) => {
            if (prev.threads[t.id]) return prev;
            const nextThreads = { ...prev.threads, [t.id]: true };
            return { threads: nextThreads, dms: prev.dms, any: true };
          });
        } catch (err) {
          console.warn('[useSupportUnread] thread check failed', t.id, err);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [dmLastSeen, dmRooms, mxClient, ownerUserId, supportRoomId, threadLastSeen, threads]);

  // -------- Live update on incoming timeline events --------
  useEffect(() => {
    if (!mxClient) return;
    const handler = (event: MatrixEvent, room: Room | undefined) => {
      if (!room) return;
      if (event.getType() !== 'm.room.message') return;
      if (event.getSender() === ownerUserId) return;
      const ts = event.getTs();
      // DM match?
      if (dmRooms.some((d) => d.roomId === room.roomId)) {
        const since = dmLastSeen[room.roomId] ?? 0;
        if (ts <= since) return;
        setResult((prev) => {
          if (prev.dms[room.roomId]) return prev;
          return { threads: prev.threads, dms: { ...prev.dms, [room.roomId]: true }, any: true };
        });
        return;
      }
      // Thread reply match?
      if (room.roomId === supportRoomId) {
        const content = event.getContent() as { 'm.relates_to'?: { rel_type?: string; event_id?: string } };
        const rel = content['m.relates_to'];
        if (rel?.rel_type !== 'm.thread' || !rel.event_id) return;
        const rootId = rel.event_id;
        if (!threads.some((t) => t.id === rootId)) return;
        const since = threadLastSeen[rootId] ?? 0;
        if (ts <= since) return;
        setResult((prev) => {
          if (prev.threads[rootId]) return prev;
          return { threads: { ...prev.threads, [rootId]: true }, dms: prev.dms, any: true };
        });
      }
    };
    mxClient.on('Room.timeline' as any, handler);
    return () => {
      mxClient.off('Room.timeline' as any, handler);
    };
  }, [dmLastSeen, dmRooms, mxClient, ownerUserId, supportRoomId, threadLastSeen, threads]);

  return result;
}

function computeDmUnread(
  mxClient: MatrixClient,
  dmRooms: SupportDmRoom[],
  ownerUserId: string,
  dmLastSeen: Record<string, number>,
): Record<string, boolean> {
  const map: Record<string, boolean> = {};
  for (const dm of dmRooms) {
    const room = mxClient.getRoom(dm.roomId);
    if (!room) continue;
    const events = (room as any).getLiveTimeline?.()?.getEvents?.() ?? [];
    const since = dmLastSeen[dm.roomId] ?? 0;
    for (const e of events as MatrixEvent[]) {
      if (e.getType() !== 'm.room.message') continue;
      if (e.getSender() === ownerUserId) continue;
      if (e.getTs() > since) {
        map[dm.roomId] = true;
        break;
      }
    }
  }
  return map;
}
