import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import type { MatrixClient, MatrixEvent, Room } from 'matrix-js-sdk';

import type { MatrixUserProfile } from '@store/slices/matrixProfilesSlice';
import {
  RawThreadEvent,
  extractRawEvent,
  fetchThreadReplies,
  fetchThreadRoot,
  isThreadReplyFor,
  postThreadReply,
} from 'lib/matrix/support';

import ChatInput from '../parts/ChatInput';
import DateDivider from '../parts/DateDivider';
import MessageRow from '../parts/MessageRow';
import { formatShortDate, isSameDay } from '../format';

type SupportThreadViewProps = {
  mxClient: MatrixClient;
  supportRoomId: string;
  rootId: string;
  ownerUserId: string;
  profilesById: Record<string, MatrixUserProfile>;
  /** Users with elevated power level in the support room — render an "Admin" badge on their messages. */
  adminUserIds: Set<string>;
  /** Optional optimistic seed used until the canonical fetch resolves. */
  seedRoot?: RawThreadEvent | null;
  /** Invoked when the root 404s during load — caller cleans up persisted ids + returns to selector. */
  onStaleRoot: (rootId: string) => void;
  /** Reports senders observed in this view so the parent can prefetch profiles. */
  onObserveSenders?: (senders: string[]) => void;
  /** Bump this thread's "seen" timestamp. Called on mount + unmount. */
  onMarkSeen: (rootId: string) => void;
};

export default function SupportThreadView({
  mxClient,
  supportRoomId,
  rootId,
  ownerUserId,
  profilesById,
  adminUserIds,
  seedRoot,
  onStaleRoot,
  onObserveSenders,
  onMarkSeen,
}: SupportThreadViewProps) {
  const [root, setRoot] = useState<RawThreadEvent | null>(seedRoot ?? null);
  const [replies, setReplies] = useState<RawThreadEvent[]>([]);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);

  // -------- Mark this thread as seen on entry and on exit --------
  useEffect(() => {
    onMarkSeen(rootId);
    return () => onMarkSeen(rootId);
  }, [onMarkSeen, rootId]);

  // -------- Load thread root + replies on mount / rootId change --------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [fetchedRoot, fetchedReplies] = await Promise.all([
          fetchThreadRoot(mxClient, supportRoomId, rootId),
          fetchThreadReplies(mxClient, supportRoomId, rootId),
        ]);
        if (cancelled) return;
        setRoot(fetchedRoot);
        setReplies(fetchedReplies);
      } catch (err) {
        if (cancelled) return;
        const httpStatus = (err as { httpStatus?: number })?.httpStatus;
        if (httpStatus === 404) {
          onStaleRoot(rootId);
          return;
        }
        const message = err instanceof Error ? err.message : 'Could not load conversation.';
        console.error('[SupportThreadView] load failed', err);
        toast.error(message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mxClient, onStaleRoot, rootId, supportRoomId]);

  // -------- Live timeline subscription for this thread --------
  useEffect(() => {
    const handler = (event: MatrixEvent, room: Room | undefined) => {
      if (!room || room.roomId !== supportRoomId) return;
      if (event.getType() !== 'm.room.message') return;
      const raw = extractRawEvent(event);
      const isRoot = raw.event_id === rootId;
      const isReply = isThreadReplyFor(raw, rootId);
      if (!isRoot && !isReply) return;
      if (isRoot) {
        setRoot((prev) => prev ?? raw);
        return;
      }
      setReplies((prev) => {
        if (prev.some((r) => r.event_id === raw.event_id)) return prev;
        return [...prev, raw].sort((a, b) => a.origin_server_ts - b.origin_server_ts);
      });
    };

    mxClient.on('Room.timeline' as any, handler);
    return () => {
      mxClient.off('Room.timeline' as any, handler);
    };
  }, [mxClient, rootId, supportRoomId]);

  // -------- Report senders so parent can prefetch profiles --------
  useEffect(() => {
    if (!onObserveSenders) return;
    const senders: string[] = [];
    if (root?.sender) senders.push(root.sender);
    for (const r of replies) {
      if (r.sender) senders.push(r.sender);
    }
    if (senders.length > 0) onObserveSenders(senders);
  }, [onObserveSenders, replies, root?.sender]);

  const sendReply = useCallback(async () => {
    const text = replyText.trim();
    if (!text) return;
    const lastEventId = replies[replies.length - 1]?.event_id ?? root?.event_id ?? rootId;
    setSending(true);
    try {
      await postThreadReply(mxClient, supportRoomId, rootId, lastEventId, text);
      setReplyText('');
      // The timeline subscription will append the event when sync delivers it.
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not send reply.';
      console.error('[SupportThreadView] send reply failed', err);
      toast.error(message);
    } finally {
      setSending(false);
    }
  }, [mxClient, replies, replyText, root?.event_id, rootId, supportRoomId]);

  // Flatten root + replies into a single ascending-by-ts list for unified rendering.
  const allMessages = useMemo(() => {
    return root ? [root, ...replies] : [];
  }, [replies, root]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingBottom: '12px' }}>
        {root && (
          <div style={{ display: 'flex', justifyContent: 'center', margin: '4px 0 12px' }}>
            <span
              style={{
                display: 'inline-block',
                padding: '4px 10px',
                borderRadius: '999px',
                backgroundColor: 'var(--bg-secondary)',
                color: 'var(--text-secondary, #777)',
                fontSize: '11px',
                lineHeight: 1.2,
              }}
            >
              Started on {formatShortDate(root.origin_server_ts)}
            </span>
          </div>
        )}
        {!root && <div style={{ color: 'var(--text-secondary, #777)', padding: '8px 0' }}>Loading conversation…</div>}
        {allMessages.map((msg, idx) => {
          const prev = idx > 0 ? allMessages[idx - 1] : null;
          // The "Started on …" chip above already labels the first day, so skip the divider before
          // the very first message. Subsequent days still get their own divider.
          const showDayDivider = !!prev && !isSameDay(prev.origin_server_ts, msg.origin_server_ts);
          const isMine = msg.sender === ownerUserId;
          const cachedProfile = profilesById[msg.sender];
          const senderLabel = isMine ? 'You' : cachedProfile?.displayName || msg.sender;
          const avatarUrl = isMine ? null : cachedProfile?.avatarUrl ?? null;
          const isAdmin = !isMine && adminUserIds.has(msg.sender);
          return (
            <Fragment key={msg.event_id}>
              {showDayDivider && <DateDivider timestamp={msg.origin_server_ts} />}
              <MessageRow
                senderUserId={msg.sender}
                senderLabel={senderLabel}
                avatarUrl={avatarUrl}
                timestamp={msg.origin_server_ts}
                isAdmin={isAdmin}
                body={msg.content?.body ?? ''}
              />
            </Fragment>
          );
        })}
      </div>

      <ChatInput
        value={replyText}
        onChange={setReplyText}
        onSend={() => void sendReply()}
        placeholder='Reply…'
        sendAriaLabel='Send reply'
        sending={sending}
      />
    </div>
  );
}
