import { useCallback, useState } from 'react';
import { useRouter } from 'next/router';
import type { MatrixClient } from 'matrix-js-sdk';

import Header from '@components/Header/Header';
import { useAppSelector } from '@store/hooks';
import { useSupportInit } from '@hooks/useSupportInit';
import { useSupportProfilePrefetch } from '@hooks/useSupportProfilePrefetch';
import { useSupportUnread } from '@hooks/useSupportUnread';
import { SupportDmRoom, SupportLastSeen, SupportThreadEntry } from 'lib/matrix/support';

import AdminBadge from '@components/Support/parts/AdminBadge';
import SupportDmInviteModal from '@components/Support/SupportDmInviteModal';
import SupportLoadingView from '@components/Support/views/SupportLoadingView';
import SupportErrorView from '@components/Support/views/SupportErrorView';
import SupportSelectorView from '@components/Support/views/SupportSelectorView';

type SupportScreenProps = {
  entityDid: string;
  promptsKey?: string;
};

function buildSupportRouteSuffix(promptsKey?: string): string {
  return promptsKey ? `?prompts=${encodeURIComponent(promptsKey)}` : '';
}

export default function SupportScreen({ entityDid, promptsKey }: SupportScreenProps) {
  const router = useRouter();
  const init = useSupportInit(entityDid);

  const goToProfile = useCallback(() => {
    void router.push('/profile');
  }, [router]);

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <Header onGradient title='Support' onBack={goToProfile} />

      <main
        style={{
          width: '100%',
          maxWidth: 'var(--max-width)',
          margin: '0 auto',
          padding: '0 20px var(--dock-clearance)',
          paddingTop: 'calc(var(--header-height) + 4px)',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
        }}
      >
        {/* Quiet inset note replaces the old gradient hero. */}
        <div className='card card--inset' style={{ padding: '14px 16px', marginBottom: 16 }}>
          <p
            className='muted'
            style={{
              margin: 0,
              fontSize: '14px',
              lineHeight: 1.7,
            }}
          >
            Support chats are public and anyone can join in to help. Users with the <AdminBadge /> badge are verified
            admins - be cautious with advice or requests from others.
          </p>
        </div>

        {init.kind === 'loading' && <SupportLoadingView />}
        {init.kind === 'error' && <SupportErrorView message={init.message} onClose={goToProfile} />}
        {init.kind === 'ready' && (
          <ReadySupportScreen
            mxClient={init.mxClient}
            supportRoomId={init.supportRoomId}
            initialThreads={init.initialThreads}
            initialDmRooms={init.initialDmRooms}
            initialDmInvites={init.initialDmInvites}
            initialLastSeen={init.initialLastSeen}
            entityDid={entityDid}
            promptsKey={promptsKey}
          />
        )}
      </main>
    </div>
  );
}

type ReadyScreenProps = {
  mxClient: MatrixClient;
  supportRoomId: string;
  initialThreads: SupportThreadEntry[];
  initialDmRooms: SupportDmRoom[];
  initialDmInvites: SupportDmRoom[];
  initialLastSeen: SupportLastSeen;
  entityDid: string;
  promptsKey?: string;
};

function ReadySupportScreen({
  mxClient,
  supportRoomId,
  initialThreads,
  initialDmRooms,
  initialDmInvites,
  initialLastSeen,
  entityDid,
  promptsKey,
}: ReadyScreenProps) {
  const router = useRouter();
  const threads = initialThreads;
  const [dmRooms, setDmRooms] = useState<SupportDmRoom[]>(initialDmRooms);
  const [dmInvites, setDmInvites] = useState<SupportDmRoom[]>(initialDmInvites);
  const [reviewingInvite, setReviewingInvite] = useState<SupportDmRoom | null>(null);

  const profilesById = useAppSelector((state) => state.matrixProfiles.byUserId);
  const ownerUserId = mxClient.getUserId() ?? '';

  const unread = useSupportUnread({
    mxClient,
    supportRoomId,
    ownerUserId,
    threads,
    dmRooms,
    threadLastSeen: initialLastSeen.threads,
    dmLastSeen: initialLastSeen.dms,
  });

  // Prefetch matrix profiles for any sender ids surfaced in the selector (DM admins + invite senders).
  const [observedSenders] = useState<Set<string>>(() => {
    const ids = new Set<string>();
    for (const d of initialDmRooms) ids.add(d.adminUserId);
    for (const d of initialDmInvites) ids.add(d.adminUserId);
    return ids;
  });
  useSupportProfilePrefetch(observedSenders);

  const routeSuffix = buildSupportRouteSuffix(promptsKey);

  const openThread = useCallback(
    (rootId: string) => {
      void router.push(
        `/profile/support/${encodeURIComponent(entityDid)}/thread/${encodeURIComponent(rootId)}${routeSuffix}`,
      );
    },
    [entityDid, routeSuffix, router],
  );

  const openDm = useCallback(
    (roomId: string) => {
      void router.push(
        `/profile/support/${encodeURIComponent(entityDid)}/dm/${encodeURIComponent(roomId)}${routeSuffix}`,
      );
    },
    [entityDid, routeSuffix, router],
  );

  const openNewThread = useCallback(() => {
    void router.push(`/profile/support/${encodeURIComponent(entityDid)}/new${routeSuffix}`);
  }, [entityDid, routeSuffix, router]);

  const openInvite = useCallback((roomId: string, adminUserId: string) => {
    setReviewingInvite({ roomId, adminUserId });
  }, []);

  const closeInviteModal = useCallback(() => setReviewingInvite(null), []);

  const handleInviteApproved = useCallback(
    (roomId: string) => {
      const accepted = dmInvites.find((d) => d.roomId === roomId);
      setDmInvites((prev) => prev.filter((d) => d.roomId !== roomId));
      if (accepted) {
        setDmRooms((prev) => (prev.some((d) => d.roomId === roomId) ? prev : [...prev, accepted]));
      }
      setReviewingInvite(null);
      openDm(roomId);
    },
    [dmInvites, openDm],
  );

  const handleInviteRejected = useCallback((roomId: string) => {
    setDmInvites((prev) => prev.filter((d) => d.roomId !== roomId));
    setReviewingInvite(null);
  }, []);

  return (
    <>
      <SupportSelectorView
        threads={threads}
        dmRooms={dmRooms}
        dmInvites={dmInvites}
        profilesById={profilesById}
        threadUnread={unread.threads}
        dmUnread={unread.dms}
        onOpenThread={openThread}
        onOpenDm={openDm}
        onOpenInvite={openInvite}
        onNewThread={openNewThread}
      />
      {reviewingInvite && (
        <SupportDmInviteModal
          mxClient={mxClient}
          roomId={reviewingInvite.roomId}
          adminUserId={reviewingInvite.adminUserId}
          onClose={closeInviteModal}
          onApproved={handleInviteApproved}
          onRejected={handleInviteRejected}
        />
      )}
    </>
  );
}
