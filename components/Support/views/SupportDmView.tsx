import { Fragment, useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import type { MatrixClient, MatrixEvent, Room } from 'matrix-js-sdk';

import type { MatrixUserProfile } from '@store/slices/matrixProfilesSlice';
import { RawDmMessage, readDmMessagesFromRoom, sendDmMessage } from 'lib/matrix/support';

import ChatInput from '../parts/ChatInput';
import DateDivider from '../parts/DateDivider';
import MessageRow from '../parts/MessageRow';
import { isSameDay } from '../format';

type SupportDmViewProps = {
  mxClient: MatrixClient;
  dmRoomId: string;
  ownerUserId: string;
  profilesById: Record<string, MatrixUserProfile>;
  /** Users with elevated power level in the support room — render an "Admin" badge on their messages. */
  adminUserIds: Set<string>;
  /** Reports senders observed in this view so the parent can prefetch profiles. */
  onObserveSenders?: (senders: string[]) => void;
  /** Bump this DM's "seen" timestamp. Called on mount + unmount. */
  onMarkSeen: (dmRoomId: string) => void;
};

export default function SupportDmView({
  mxClient,
  dmRoomId,
  ownerUserId,
  profilesById,
  adminUserIds,
  onObserveSenders,
  onMarkSeen,
}: SupportDmViewProps) {
  const [messages, setMessages] = useState<RawDmMessage[]>(() => readDmMessagesFromRoom(mxClient, dmRoomId));
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);

  // -------- Mark this DM as seen on entry and on exit --------
  useEffect(() => {
    onMarkSeen(dmRoomId);
    return () => onMarkSeen(dmRoomId);
  }, [dmRoomId, onMarkSeen]);

  // -------- Live timeline + decryption subscription --------
  useEffect(() => {
    const refresh = () => setMessages(readDmMessagesFromRoom(mxClient, dmRoomId));

    const timelineHandler = (_event: MatrixEvent, room: Room | undefined) => {
      if (!room || room.roomId !== dmRoomId) return;
      refresh();
    };

    const decryptedHandler = (event: MatrixEvent) => {
      if (event.getRoomId?.() !== dmRoomId) return;
      refresh();
    };

    // Seed once at subscription time in case anything arrived between mount and effect run.
    refresh();

    mxClient.on('Room.timeline' as any, timelineHandler);
    mxClient.on('Event.decrypted' as any, decryptedHandler);
    return () => {
      mxClient.off('Room.timeline' as any, timelineHandler);
      mxClient.off('Event.decrypted' as any, decryptedHandler);
    };
  }, [dmRoomId, mxClient]);

  // -------- Report senders to parent for profile prefetch --------
  useEffect(() => {
    if (!onObserveSenders) return;
    const senders = messages.map((m) => m.sender).filter(Boolean);
    if (senders.length > 0) onObserveSenders(senders);
  }, [messages, onObserveSenders]);

  const sendReply = useCallback(async () => {
    const text = replyText.trim();
    if (!text) return;
    setSending(true);
    try {
      await sendDmMessage(mxClient, dmRoomId, text);
      setReplyText('');
      // The timeline subscription will pick up the echoed event.
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not send DM.';
      console.error('[SupportDmView] send failed', err);
      toast.error(message);
    } finally {
      setSending(false);
    }
  }, [dmRoomId, mxClient, replyText]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingBottom: '12px' }}>
        {messages.length === 0 && (
          <div style={{ color: 'var(--text-secondary, #777)', padding: '8px 0' }}>
            No messages yet — say hi to start the conversation.
          </div>
        )}
        {messages.map((msg, idx) => {
          const prev = idx > 0 ? messages[idx - 1] : null;
          const showDayDivider = !prev || !isSameDay(prev.origin_server_ts, msg.origin_server_ts);
          const isMine = msg.sender === ownerUserId;
          const cachedProfile = profilesById[msg.sender];
          const senderLabel = isMine ? 'You' : cachedProfile?.displayName || msg.sender;
          const avatarUrl = isMine ? null : cachedProfile?.avatarUrl ?? null;
          const isAdmin = !isMine && adminUserIds.has(msg.sender);
          const isEncrypted = msg.status === 'encrypted';
          return (
            <Fragment key={msg.event_id}>
              {showDayDivider && <DateDivider timestamp={msg.origin_server_ts} />}
              <MessageRow
                senderUserId={msg.sender}
                senderLabel={senderLabel}
                avatarUrl={avatarUrl}
                timestamp={msg.origin_server_ts}
                isAdmin={isAdmin}
                body={
                  <span
                    style={{
                      fontStyle: isEncrypted ? 'italic' : 'normal',
                      color: isEncrypted ? 'var(--text-secondary, #777)' : 'inherit',
                    }}
                  >
                    {msg.body}
                  </span>
                }
              />
            </Fragment>
          );
        })}
      </div>

      <ChatInput
        value={replyText}
        onChange={setReplyText}
        onSend={() => void sendReply()}
        placeholder='Type a message…'
        sendAriaLabel='Send message'
        sending={sending}
      />
    </div>
  );
}
