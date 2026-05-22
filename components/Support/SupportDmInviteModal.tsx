import { useCallback, useState } from 'react';
import { toast } from 'react-toastify';
import type { MatrixClient } from 'matrix-js-sdk';

import Button, { BUTTON_BG_COLOR, BUTTON_BORDER_COLOR, BUTTON_COLOR, BUTTON_SIZE } from '@components/Button/Button';
import Modal from '@components/Modal/Modal';
import { useAppSelector } from '@store/hooks';
import { acceptDmInvite, isRoomEncrypted, rejectDmInvite } from 'lib/matrix/support';

import AdminBadge from './parts/AdminBadge';
import UserAvatar from './parts/UserAvatar';

type SupportDmInviteModalProps = {
  mxClient: MatrixClient;
  roomId: string;
  adminUserId: string;
  onClose: () => void;
  onApproved: (roomId: string) => void;
  onRejected: (roomId: string) => void;
};

export default function SupportDmInviteModal({
  mxClient,
  roomId,
  adminUserId,
  onClose,
  onApproved,
  onRejected,
}: SupportDmInviteModalProps) {
  const profilesById = useAppSelector((state) => state.matrixProfiles.byUserId);
  const profile = profilesById[adminUserId];
  const displayName = profile?.displayName || adminUserId;
  const avatarUrl = profile?.avatarUrl ?? null;
  const encrypted = isRoomEncrypted(mxClient, roomId);

  const [busy, setBusy] = useState<'idle' | 'accepting' | 'rejecting'>('idle');

  const handleApprove = useCallback(async () => {
    if (busy !== 'idle') return;
    setBusy('accepting');
    try {
      await acceptDmInvite(mxClient, roomId);
      onApproved(roomId);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not accept invite.';
      console.error('[SupportDmInviteModal] accept failed', err);
      toast.error(message);
      setBusy('idle');
    }
  }, [busy, mxClient, onApproved, roomId]);

  const handleReject = useCallback(async () => {
    if (busy !== 'idle') return;
    setBusy('rejecting');
    try {
      await rejectDmInvite(mxClient, roomId);
      onRejected(roomId);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not reject invite.';
      console.error('[SupportDmInviteModal] reject failed', err);
      toast.error(message);
      setBusy('idle');
    }
  }, [busy, mxClient, onRejected, roomId]);

  return (
    <Modal onClose={onClose} title='Direct message invite'>
      <div style={{ padding: '8px 16px 20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <UserAvatar userId={adminUserId} displayName={displayName} avatarUrl={avatarUrl} size={48} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '15px', fontWeight: 500, color: 'var(--text-primary)' }}>{displayName}</span>
              <AdminBadge />
            </div>
            <div
              style={{
                marginTop: '2px',
                fontSize: '11px',
                color: 'var(--text-secondary, #777)',
                wordBreak: 'break-all',
              }}
            >
              {adminUserId}
            </div>
          </div>
        </div>

        <p
          style={{
            margin: 0,
            fontSize: '13px',
            lineHeight: 1.5,
            color: 'var(--text-primary)',
          }}
        >
          This user is a <strong>verified support admin</strong>.{' '}
          {encrypted ? (
            <>
              This conversation is <strong>end-to-end encrypted</strong> — safer for sharing personal details, but still
              only share what is necessary.
            </>
          ) : (
            <>
              This conversation is <strong>not encrypted</strong> — do not share any personal information, IDs or
              document contents here.
            </>
          )}
        </p>

        <div style={{ display: 'flex', gap: '10px' }}>
          <Button
            label={busy === 'rejecting' ? 'Rejecting…' : 'Reject'}
            onClick={handleReject}
            disabled={busy !== 'idle'}
            color={BUTTON_COLOR.primary}
            borderColor={BUTTON_BORDER_COLOR.primary}
            size={BUTTON_SIZE.mediumLarge}
            style={{ flex: 1, padding: '12px 16px', borderRadius: '10px' }}
          />
          <Button
            label={busy === 'accepting' ? 'Joining…' : 'Approve & join'}
            onClick={handleApprove}
            disabled={busy !== 'idle'}
            bgColor={BUTTON_BG_COLOR.primary}
            borderColor={BUTTON_BORDER_COLOR.primary}
            color={BUTTON_COLOR.white}
            size={BUTTON_SIZE.mediumLarge}
            style={{ flex: 1, padding: '12px 16px', borderRadius: '10px' }}
          />
        </div>
      </div>
    </Modal>
  );
}
