import { useCallback, useState } from 'react';
import { useRouter } from 'next/router';

import Header from '@components/Header/Header';
import { useAppSelector } from '@store/hooks';
import { useSupportInit } from '@hooks/useSupportInit';
import { useSupportProfilePrefetch } from '@hooks/useSupportProfilePrefetch';
import {
  markSupportThreadSeen,
  removeSupportThreadId,
} from 'lib/matrix/support';
import type { MatrixClient } from 'matrix-js-sdk';

import SupportLoadingView from '@components/Support/views/SupportLoadingView';
import SupportErrorView from '@components/Support/views/SupportErrorView';
import SupportThreadView from '@components/Support/views/SupportThreadView';

type SupportThreadScreenProps = {
  entityDid: string;
  rootId: string;
};

export default function SupportThreadScreen({ entityDid, rootId }: SupportThreadScreenProps) {
  const router = useRouter();
  const init = useSupportInit(entityDid);

  const goBack = useCallback(() => {
    if (window.history.length > 1) {
      router.back();
    } else {
      void router.push(`/profile/support/${encodeURIComponent(entityDid)}`);
    }
  }, [entityDid, router]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header onGradient title='Public Support' onBack={goBack} />

      {/* Thin gradient band behind the header so its onGradient styles render correctly. */}
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
        {init.kind === 'ready' && (
          <ReadyThread
            mxClient={init.mxClient}
            supportRoomId={init.supportRoomId}
            userRoomId={init.userRoomId}
            adminUserIds={init.adminUserIds}
            rootId={rootId}
            goBack={goBack}
          />
        )}
      </main>
    </div>
  );
}

type ReadyThreadProps = {
  mxClient: MatrixClient;
  supportRoomId: string;
  userRoomId: string;
  adminUserIds: Set<string>;
  rootId: string;
  goBack: () => void;
};

function ReadyThread({ mxClient, supportRoomId, userRoomId, adminUserIds, rootId, goBack }: ReadyThreadProps) {
  const profilesById = useAppSelector((state) => state.matrixProfiles.byUserId);
  const ownerUserId = mxClient.getUserId() ?? '';

  const [observedSenders, setObservedSenders] = useState<Set<string>>(() => new Set());
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
      void markSupportThreadSeen(mxClient, userRoomId, supportRoomId, id, ts).catch((err) =>
        console.warn('[SupportThreadScreen] failed to mark thread seen', err),
      );
    },
    [mxClient, supportRoomId, userRoomId],
  );

  const handleStaleRoot = useCallback(
    (id: string) => {
      void removeSupportThreadId(mxClient, userRoomId, supportRoomId, id).catch((err) =>
        console.warn('[SupportThreadScreen] failed to clean up stale thread', err),
      );
      goBack();
    },
    [goBack, mxClient, supportRoomId, userRoomId],
  );

  return (
    <SupportThreadView
      mxClient={mxClient}
      supportRoomId={supportRoomId}
      rootId={rootId}
      ownerUserId={ownerUserId}
      profilesById={profilesById}
      adminUserIds={adminUserIds}
      onStaleRoot={handleStaleRoot}
      onObserveSenders={observeSenders}
      onMarkSeen={handleMarkSeen}
    />
  );
}
