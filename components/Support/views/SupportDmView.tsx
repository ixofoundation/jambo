import { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import type { MatrixClient, MatrixEvent, Room } from 'matrix-js-sdk';

import type { MatrixUserProfile } from '@store/slices/matrixProfilesSlice';
import { RawDmMessage, readDmMessagesFromRoom, sendDmMessage } from 'lib/matrix/support';

import ChatInput from '../parts/ChatInput';
import MessageMetaRow from '../parts/MessageMetaRow';
import {
  messageBodyStyle,
  messageBottomDividerStyle,
  messageRowStyle,
} from '../styles';

type SupportDmViewProps = {
  mxClient: MatrixClient;
  dmRoomId: string;
  adminUserId: string;
  ownerUserId: string;
  profilesById: Record<string, MatrixUserProfile>;
  /** Reports senders observed in this view so the parent can prefetch profiles. */
  onObserveSenders?: (senders: string[]) => void;
  /** Bump this DM's "seen" timestamp. Called on mount + unmount. */
  onMarkSeen: (dmRoomId: string) => void;
};

export default function SupportDmView({
  mxClient,
  dmRoomId,
  adminUserId,
  ownerUserId,
  profilesById,
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

  const adminLabel = profilesById[adminUserId]?.displayName || adminUserId;

  return (
    <div style={{ padding: '16px' }}>
      <div
        style={{
          fontSize: '12px',
          color: 'var(--text-secondary, #777)',
          marginBottom: '8px',
        }}
      >
        Private chat with {adminLabel}
      </div>

      <div style={{ marginBottom: '12px' }}>
        {messages.length === 0 && (
          <div style={{ ...messageRowStyle, color: 'var(--text-secondary, #777)' }}>
            No messages yet — say hi to start the conversation.
          </div>
        )}
        {messages.map((msg, idx) => {
          const isMine = msg.sender === ownerUserId;
          const senderLabel = isMine ? 'You' : profilesById[msg.sender]?.displayName || msg.sender;
          const isLast = idx === messages.length - 1;
          return (
            <div
              key={msg.event_id}
              style={{
                ...messageRowStyle,
                ...(!isLast ? messageBottomDividerStyle : {}),
              }}
            >
              <MessageMetaRow senderLabel={senderLabel} timestamp={msg.origin_server_ts} />
              <div
                style={{
                  ...messageBodyStyle,
                  fontStyle: msg.status === 'encrypted' ? 'italic' : 'normal',
                  color: msg.status === 'encrypted' ? 'var(--text-secondary, #777)' : 'inherit',
                }}
              >
                {msg.body}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
        <ChatInput
          value={replyText}
          onChange={setReplyText}
          onSend={() => void sendReply()}
          placeholder='Type a message…'
          sendAriaLabel='Send message'
          sending={sending}
        />
      </div>
    </div>
  );
}
