import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/router';

import Header from '@components/Header/Header';
import { useAppSelector } from '@store/hooks';
import { useSupportInit } from '@hooks/useSupportInit';
import { useSupportProfilePrefetch } from '@hooks/useSupportProfilePrefetch';
import { markSupportDmSeen } from 'lib/matrix/support';
import type { MatrixClient } from 'matrix-js-sdk';

import SupportLoadingView from '@components/Support/views/SupportLoadingView';
import SupportErrorView from '@components/Support/views/SupportErrorView';
import SupportDmView from '@components/Support/views/SupportDmView';

type SupportDmScreenProps = {
  entityDid: string;
  roomId: string;
};

export default function SupportDmScreen({ entityDid, roomId }: SupportDmScreenProps) {
  const router = useRouter();
  const init = useSupportInit(entityDid);
  const profilesById = useAppSelector((state) => state.matrixProfiles.byUserId);

  const goBack = useCallback(() => {
    if (window.history.length > 1) {
      router.back();
    } else {
      void router.push(`/profile/support/${encodeURIComponent(entityDid)}`);
    }
  }, [entityDid, router]);

  // Resolve which admin user this DM is with as soon as init is ready. Prefer the value seeded
  // by init; fall back to inspecting room members (any joined member other than the current user).
  const adminUserId = useMemo(() => {
    if (init.kind !== 'ready') return null;
    const seeded = init.initialDmRooms.find((d) => d.roomId === roomId)?.adminUserId;
    if (seeded) return seeded;
    const ownerUserId = init.mxClient.getUserId() ?? '';
    const room = init.mxClient.getRoom(roomId);
    if (!room) return null;
    const others = room
      .getMembers()
      .filter((m) => m.userId !== ownerUserId && (m.membership === 'join' || m.membership === 'invite'));
    const adminMatch = others.find((m) => init.adminUserIds.has(m.userId));
    return (adminMatch ?? others[0])?.userId ?? null;
  }, [init, roomId]);

  const title = useMemo(() => {
    if (!adminUserId) return 'Support';
    return profilesById[adminUserId]?.displayName || adminUserId;
  }, [adminUserId, profilesById]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header onGradient title={title} onBack={goBack} />

      <div
        style={{
          background: 'radial-gradient(ellipse at top right, var(--green-secondary), var(--green-primary) 70%)',
          height: 'var(--header-height)',
        }}
      />

      <main
        style={{
          width: '100%',
          maxWidth: 'var(--max-width)',
          margin: '0 auto',
          padding: '16px',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
        }}
      >
        {init.kind === 'loading' && <SupportLoadingView />}
        {init.kind === 'error' && <SupportErrorView message={init.message} onClose={goBack} />}
        {init.kind === 'ready' && !adminUserId && (
          <SupportErrorView message="Couldn't resolve this conversation." onClose={goBack} />
        )}
        {init.kind === 'ready' && adminUserId && (
          <ReadyDm
            mxClient={init.mxClient}
            supportRoomId={init.supportRoomId}
            userRoomId={init.userRoomId}
            adminUserIds={init.adminUserIds}
            adminUserId={adminUserId}
            roomId={roomId}
          />
        )}
      </main>
    </div>
  );
}

type ReadyDmProps = {
  mxClient: MatrixClient;
  supportRoomId: string;
  userRoomId: string;
  adminUserIds: Set<string>;
  adminUserId: string;
  roomId: string;
};

function ReadyDm({ mxClient, supportRoomId, userRoomId, adminUserIds, adminUserId, roomId }: ReadyDmProps) {
  const profilesById = useAppSelector((state) => state.matrixProfiles.byUserId);
  const ownerUserId = mxClient.getUserId() ?? '';

  const [observedSenders, setObservedSenders] = useState<Set<string>>(() => new Set([adminUserId]));
  const observeSenders = useCallback((senders: string[]) => {
    setObservedSenders((prev) => {
      let changed = false;
      const next = new Set(prev);
      for (const s of senders) {
        if (!s || next.has(s)) continue;
        next.add(s);
        changed = true;
      }
      return changed ? next : prev;
    });
  }, []);
  useSupportProfilePrefetch(observedSenders);

  const handleMarkSeen = useCallback(
    (id: string) => {
      const ts = Date.now();
      void markSupportDmSeen(mxClient, userRoomId, supportRoomId, id, ts).catch((err) =>
        console.warn('[SupportDmScreen] failed to mark dm seen', err),
      );
    },
    [mxClient, supportRoomId, userRoomId],
  );

  return (
    <SupportDmView
      mxClient={mxClient}
      dmRoomId={roomId}
      ownerUserId={ownerUserId}
      profilesById={profilesById}
      adminUserIds={adminUserIds}
      onObserveSenders={observeSenders}
      onMarkSeen={handleMarkSeen}
    />
  );
}
