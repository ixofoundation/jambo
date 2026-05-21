import { Fragment, useCallback, useEffect, useState } from 'react';
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
import MessageMetaRow from '../parts/MessageMetaRow';
import {
  messageBodyStyle,
  messageBottomDividerStyle,
  messageRowStyle,
  threadRepliesContainerStyle,
} from '../styles';

type SupportThreadViewProps = {
  mxClient: MatrixClient;
  supportRoomId: string;
  rootId: string;
  ownerUserId: string;
  profilesById: Record<string, MatrixUserProfile>;
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

  const renderMessage = (msg: RawThreadEvent, isRoot: boolean, showBottomDivider: boolean) => {
    const isMine = msg.sender === ownerUserId;
    const cachedProfile = profilesById[msg.sender];
    const senderLabel = isMine ? 'You' : cachedProfile?.displayName || msg.sender;
    const body = msg.content?.body ?? '';
    return (
      <div
        style={{
          ...messageRowStyle,
          ...(showBottomDivider ? messageBottomDividerStyle : {}),
        }}
      >
        <MessageMetaRow
          senderLabel={senderLabel}
          timestamp={msg.origin_server_ts}
          trailing={isRoot ? '• Thread start' : undefined}
        />
        <div style={messageBodyStyle}>{body}</div>
      </div>
    );
  };

  return (
    <div style={{ padding: '16px' }}>
      <div style={{ marginBottom: '12px' }}>
        {root ? (
          renderMessage(root, true, replies.length > 0)
        ) : (
          <div style={{ ...messageRowStyle, color: 'var(--text-secondary, #777)' }}>Loading conversation…</div>
        )}
        {replies.length > 0 && (
          <div style={threadRepliesContainerStyle}>
            {replies.map((r, idx) => (
              <Fragment key={r.event_id}>{renderMessage(r, false, idx < replies.length - 1)}</Fragment>
            ))}
          </div>
        )}
      </div>

      <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
        <ChatInput
          value={replyText}
          onChange={setReplyText}
          onSend={() => void sendReply()}
          placeholder='Reply…'
          sendAriaLabel='Send reply'
          sending={sending}
        />
      </div>
    </div>
  );
}
