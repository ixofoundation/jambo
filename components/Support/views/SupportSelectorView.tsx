import { useCallback, useState } from 'react';

import Button, { BUTTON_BG_COLOR, BUTTON_BORDER_COLOR, BUTTON_COLOR, BUTTON_SIZE } from '@components/Button/Button';
import { KYC_SUPPORT_QUICK_MESSAGES } from '@constants/support';
import type { MatrixUserProfile } from '@store/slices/matrixProfilesSlice';
import type { SupportDmRoom, SupportThreadEntry } from 'lib/matrix/support';

import PrivacyAlert from '../parts/PrivacyAlert';
import { formatRelativeAgo } from '../format';
import {
  quickMessageButtonStyle,
  sectionTitleStyle,
  textareaStyle,
  threadEntryButtonStyle,
} from '../styles';

export type SelectorMode = { kind: 'list' } | { kind: 'options' } | { kind: 'compose' };

type SupportSelectorViewProps = {
  mode: SelectorMode;
  onModeChange: (next: SelectorMode) => void;
  threads: SupportThreadEntry[];
  dmRooms: SupportDmRoom[];
  profilesById: Record<string, MatrixUserProfile>;
  sending: boolean;
  threadUnread: Record<string, boolean>;
  dmUnread: Record<string, boolean>;
  onOpenThread: (rootId: string) => void;
  onOpenDm: (roomId: string, adminUserId: string) => void;
  onSendNew: (body: string) => void | Promise<void>;
};

const listRowUnreadDotStyle = {
  display: 'inline-block',
  width: '8px',
  height: '8px',
  borderRadius: '50%',
  backgroundColor: 'var(--error-color, #e54545)',
  flex: '0 0 auto',
} as const;

const listRowTitleStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  fontSize: '13px',
  lineHeight: 1.4,
} as const;

export default function SupportSelectorView({
  mode,
  onModeChange,
  threads,
  dmRooms,
  profilesById,
  sending,
  threadUnread,
  dmUnread,
  onOpenThread,
  onOpenDm,
  onSendNew,
}: SupportSelectorViewProps) {
  const [composeText, setComposeText] = useState('');

  const pickQuickMessage = useCallback(
    (msg: string) => {
      setComposeText(msg);
      onModeChange({ kind: 'compose' });
    },
    [onModeChange],
  );

  const pickOther = useCallback(() => {
    setComposeText('');
    onModeChange({ kind: 'compose' });
  }, [onModeChange]);

  const startNewConversation = useCallback(() => {
    setComposeText('');
    onModeChange({ kind: 'options' });
  }, [onModeChange]);

  const handleSend = useCallback(() => {
    const text = composeText.trim();
    if (!text) return;
    void onSendNew(text);
    setComposeText('');
  }, [composeText, onSendNew]);

  return (
    <div style={{ padding: '16px' }}>
      <PrivacyAlert />

      {mode.kind === 'list' && (
        <section>
          {dmRooms.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <h3 style={sectionTitleStyle}>Admin Support Conversations</h3>
              {dmRooms.map((d) => {
                const profile = profilesById[d.adminUserId];
                const label = profile?.displayName || d.adminUserId;
                const unread = !!dmUnread[d.roomId];
                return (
                  <button
                    key={d.roomId}
                    type='button'
                    style={threadEntryButtonStyle}
                    onClick={() => onOpenDm(d.roomId, d.adminUserId)}
                  >
                    <div style={listRowTitleStyle}>
                      {unread && <span aria-label='Unread' style={listRowUnreadDotStyle} />}
                      <span>{label}</span>
                    </div>
                    <div
                      style={{
                        marginTop: '4px',
                        fontSize: '11px',
                        color: 'var(--text-secondary, #777)',
                      }}
                    >
                      Private chat
                    </div>
                  </button>
                );
              })}
            </div>
          )}
          {threads.length > 0 && (
            <div>
              <h3 style={sectionTitleStyle}>Public Support Conversations</h3>
              {threads.map((t) => {
                const unread = !!threadUnread[t.id];
                return (
                  <button key={t.id} type='button' style={threadEntryButtonStyle} onClick={() => onOpenThread(t.id)}>
                    <div style={listRowTitleStyle}>
                      {unread && <span aria-label='Unread' style={listRowUnreadDotStyle} />}
                      <span>{t.preview}</span>
                    </div>
                    <div
                      style={{
                        marginTop: '4px',
                        fontSize: '11px',
                        color: 'var(--text-secondary, #777)',
                      }}
                    >
                      {formatRelativeAgo(t.createdAt)}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
          <div style={{ marginTop: '16px' }}>
            <Button
              label='Start new conversation'
              onClick={startNewConversation}
              bgColor={BUTTON_BG_COLOR.primary}
              borderColor={BUTTON_BORDER_COLOR.primary}
              color={BUTTON_COLOR.white}
              size={BUTTON_SIZE.mediumLarge}
              style={{ width: '100%', padding: '12px 16px', borderRadius: '10px' }}
            />
          </div>
        </section>
      )}

      {mode.kind === 'options' && (
        <section>
          <h3 style={sectionTitleStyle}>What&apos;s the issue?</h3>
          {KYC_SUPPORT_QUICK_MESSAGES.map((msg) => (
            <button
              key={msg}
              type='button'
              style={quickMessageButtonStyle}
              onClick={() => pickQuickMessage(msg)}
              disabled={sending}
            >
              {msg}
            </button>
          ))}
          <button
            type='button'
            style={{
              ...quickMessageButtonStyle,
              fontStyle: 'italic',
              color: 'var(--text-secondary, #777)',
            }}
            onClick={pickOther}
            disabled={sending}
          >
            Other — write your own message
          </button>
        </section>
      )}

      {mode.kind === 'compose' && (
        <section>
          <textarea
            style={textareaStyle}
            value={composeText}
            onChange={(e) => setComposeText(e.target.value)}
            placeholder="Briefly describe what's going on (no personal data, please)."
            disabled={sending}
            autoFocus
          />
          <p
            style={{
              margin: '6px 0 0',
              fontSize: '11px',
              color: 'var(--text-secondary, #777)',
              lineHeight: 1.4,
            }}
          >
            A short public-room privacy notice will be added to the start of your message.
          </p>
          <div style={{ marginTop: '12px' }}>
            <Button
              label={sending ? 'Sending…' : 'Send'}
              onClick={handleSend}
              disabled={sending || composeText.trim().length === 0}
              bgColor={BUTTON_BG_COLOR.primary}
              borderColor={BUTTON_BORDER_COLOR.primary}
              color={BUTTON_COLOR.white}
              size={BUTTON_SIZE.mediumLarge}
              style={{ width: '100%', padding: '12px 16px', borderRadius: '10px' }}
            />
          </div>
        </section>
      )}
    </div>
  );
}
