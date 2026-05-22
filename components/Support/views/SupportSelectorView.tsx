import Button, { BUTTON_BG_COLOR, BUTTON_BORDER_COLOR, BUTTON_COLOR, BUTTON_SIZE } from '@components/Button/Button';
import type { MatrixUserProfile } from '@store/slices/matrixProfilesSlice';
import type { SupportDmRoom, SupportThreadEntry } from 'lib/matrix/support';

import PrivacyAlert from '../parts/PrivacyAlert';
import { ForwardChevron } from '../icons';
import { formatRelativeAgo } from '../format';
import {
  conversationListBoxStyle,
  conversationListChevronStyle,
  conversationListRowStyle,
  sectionTitleStyle,
} from '../styles';

type SupportSelectorViewProps = {
  threads: SupportThreadEntry[];
  dmRooms: SupportDmRoom[];
  dmInvites: SupportDmRoom[];
  profilesById: Record<string, MatrixUserProfile>;
  threadUnread: Record<string, boolean>;
  dmUnread: Record<string, boolean>;
  onOpenThread: (rootId: string) => void;
  onOpenDm: (roomId: string) => void;
  onOpenInvite: (roomId: string, adminUserId: string) => void;
  onNewThread: () => void;
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
  threads,
  dmRooms,
  dmInvites,
  profilesById,
  threadUnread,
  dmUnread,
  onOpenThread,
  onOpenDm,
  onOpenInvite,
  onNewThread,
}: SupportSelectorViewProps) {
  const hasAny = threads.length > 0 || dmRooms.length > 0 || dmInvites.length > 0;
  const hasAnyAdminRow = dmRooms.length > 0 || dmInvites.length > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <section style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        {hasAnyAdminRow && (
          <div style={{ marginBottom: '16px' }}>
            <h3 style={sectionTitleStyle}>Admin Support Conversations</h3>
            <div style={conversationListBoxStyle}>
              {dmInvites.map((d, idx) => {
                const profile = profilesById[d.adminUserId];
                const label = profile?.displayName || d.adminUserId;
                const isLast = idx === dmInvites.length - 1 && dmRooms.length === 0;
                return (
                  <button
                    key={`invite-${d.roomId}`}
                    type='button'
                    style={isLast ? { ...conversationListRowStyle, borderBottom: 'none' } : conversationListRowStyle}
                    onClick={() => onOpenInvite(d.roomId, d.adminUserId)}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={listRowTitleStyle}>
                        <span>{label}</span>
                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: 600,
                            letterSpacing: '0.04em',
                            textTransform: 'uppercase',
                            padding: '1px 6px',
                            borderRadius: '4px',
                            backgroundColor: 'var(--accent-bg, rgba(59, 130, 246, 0.12))',
                            color: 'var(--accent-color, #3b82f6)',
                          }}
                        >
                          Invite
                        </span>
                      </div>
                      <div
                        style={{
                          marginTop: '4px',
                          fontSize: '11px',
                          color: 'var(--text-secondary, #777)',
                        }}
                      >
                        Tap to review and join
                      </div>
                    </div>
                    <span style={conversationListChevronStyle} aria-hidden='true'>
                      <ForwardChevron />
                    </span>
                  </button>
                );
              })}
              {dmRooms.map((d, idx) => {
                const profile = profilesById[d.adminUserId];
                const label = profile?.displayName || d.adminUserId;
                const unread = !!dmUnread[d.roomId];
                const isLast = idx === dmRooms.length - 1;
                return (
                  <button
                    key={d.roomId}
                    type='button'
                    style={isLast ? { ...conversationListRowStyle, borderBottom: 'none' } : conversationListRowStyle}
                    onClick={() => onOpenDm(d.roomId)}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
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
                    </div>
                    <span style={conversationListChevronStyle} aria-hidden='true'>
                      <ForwardChevron />
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {threads.length > 0 && (
          <div>
            <h3 style={sectionTitleStyle}>Public Support Conversations</h3>
            <PrivacyAlert />
            <div style={conversationListBoxStyle}>
              {threads.map((t, idx) => {
                const unread = !!threadUnread[t.id];
                const isLast = idx === threads.length - 1;
                return (
                  <button
                    key={t.id}
                    type='button'
                    style={isLast ? { ...conversationListRowStyle, borderBottom: 'none' } : conversationListRowStyle}
                    onClick={() => onOpenThread(t.id)}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
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
                    </div>
                    <span style={conversationListChevronStyle} aria-hidden='true'>
                      <ForwardChevron />
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {!hasAny && (
          <p
            style={{
              margin: 0,
              padding: '16px 0',
              textAlign: 'center',
              color: 'var(--text-secondary, #777)',
              fontSize: '13px',
            }}
          >
            No support conversations yet — start a new one below.
          </p>
        )}
        <div style={{ marginTop: 'auto', paddingTop: '16px' }}>
          <Button
            label='New Support Thread'
            prefixIcon={
              <svg
                width='16'
                height='16'
                viewBox='0 0 24 24'
                fill='none'
                stroke='currentColor'
                strokeWidth='2.5'
                strokeLinecap='round'
                strokeLinejoin='round'
                aria-hidden='true'
              >
                <line x1='12' y1='5' x2='12' y2='19' />
                <line x1='5' y1='12' x2='19' y2='12' />
              </svg>
            }
            onClick={onNewThread}
            bgColor={BUTTON_BG_COLOR.primary}
            borderColor={BUTTON_BORDER_COLOR.primary}
            color={BUTTON_COLOR.white}
            size={BUTTON_SIZE.mediumLarge}
            style={{ width: '100%', padding: '12px 16px', borderRadius: '10px' }}
          />
        </div>
      </section>
    </div>
  );
}
