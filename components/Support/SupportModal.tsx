import { useCallback, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import type { MatrixClient } from 'matrix-js-sdk';

import Modal from '@components/Modal/Modal';
import { SUPPORT_NEW_THREAD_PREAMBLE, SUPPORT_THREAD_LIST_CAP } from '@constants/support';
import { useAppSelector } from '@store/hooks';
import { useSupportProfilePrefetch } from '@hooks/useSupportProfilePrefetch';
import type { SupportInitStatus } from '@hooks/useSupportInit';
import {
  RawThreadEvent,
  SupportDmRoom,
  SupportThreadEntry,
  appendSupportThreadId,
  buildSupportPreview,
  postThreadRoot,
  removeSupportThreadId,
} from 'lib/matrix/support';

import { BackChevron } from './icons';
import { backChevronButtonStyle, overlayCardStyle } from './styles';
import SupportLoadingView from './views/SupportLoadingView';
import SupportErrorView from './views/SupportErrorView';
import SupportSelectorView, { SelectorMode } from './views/SupportSelectorView';
import SupportThreadView from './views/SupportThreadView';
import SupportDmView from './views/SupportDmView';

type SupportModalProps = {
  init: SupportInitStatus;
  onClose: () => void;
  threadUnread: Record<string, boolean>;
  dmUnread: Record<string, boolean>;
  onMarkThreadSeen: (rootId: string) => void;
  onMarkDmSeen: (dmRoomId: string) => void;
};

type ViewState =
  | { kind: 'selector' }
  | { kind: 'thread'; rootId: string; seedRoot?: RawThreadEvent | null }
  | { kind: 'dm'; roomId: string; adminUserId: string };

export default function SupportModal({
  init,
  onClose,
  threadUnread,
  dmUnread,
  onMarkThreadSeen,
  onMarkDmSeen,
}: SupportModalProps) {
  if (init.kind === 'loading') {
    return (
      <Modal onClose={onClose} title='Contact support' style={overlayCardStyle}>
        <SupportLoadingView />
      </Modal>
    );
  }
  if (init.kind === 'error') {
    return (
      <Modal onClose={onClose} title='Contact support' style={overlayCardStyle}>
        <SupportErrorView message={init.message} onClose={onClose} />
      </Modal>
    );
  }
  return (
    <ReadySupportModal
      onClose={onClose}
      mxClient={init.mxClient}
      supportRoomId={init.supportRoomId}
      userRoomId={init.userRoomId}
      initialThreads={init.initialThreads}
      initialDmRooms={init.initialDmRooms}
      threadUnread={threadUnread}
      dmUnread={dmUnread}
      onMarkThreadSeen={onMarkThreadSeen}
      onMarkDmSeen={onMarkDmSeen}
    />
  );
}

type ReadyProps = {
  onClose: () => void;
  mxClient: MatrixClient;
  supportRoomId: string;
  userRoomId: string;
  initialThreads: SupportThreadEntry[];
  initialDmRooms: SupportDmRoom[];
  threadUnread: Record<string, boolean>;
  dmUnread: Record<string, boolean>;
  onMarkThreadSeen: (rootId: string) => void;
  onMarkDmSeen: (dmRoomId: string) => void;
};

function ReadySupportModal({
  onClose,
  mxClient,
  supportRoomId,
  userRoomId,
  initialThreads,
  initialDmRooms,
  threadUnread,
  dmUnread,
  onMarkThreadSeen,
  onMarkDmSeen,
}: ReadyProps) {
  const [threads, setThreads] = useState<SupportThreadEntry[]>(initialThreads);
  const [dmRooms] = useState<SupportDmRoom[]>(initialDmRooms);
  const [sending, setSending] = useState(false);

  const hasAny = threads.length > 0 || dmRooms.length > 0;
  const [view, setView] = useState<ViewState>({ kind: 'selector' });
  const [selectorMode, setSelectorMode] = useState<SelectorMode>({
    kind: hasAny ? 'list' : 'options',
  });

  const profilesById = useAppSelector((state) => state.matrixProfiles.byUserId);
  const ownerUserId = mxClient.getUserId() ?? '';

  // Prefetch profiles for any user ids surfaced through the modal. Views call onObserveSenders
  // to register additional senders as they appear.
  const [observedSenders, setObservedSenders] = useState<Set<string>>(() => {
    const ids = new Set<string>();
    for (const d of dmRooms) ids.add(d.adminUserId);
    return ids;
  });
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

  const openThread = useCallback((rootId: string, seedRoot?: RawThreadEvent | null) => {
    setView({ kind: 'thread', rootId, seedRoot });
  }, []);

  const openDm = useCallback((roomId: string, adminUserId: string) => {
    setView({ kind: 'dm', roomId, adminUserId });
  }, []);

  const backToSelector = useCallback(() => {
    setView({ kind: 'selector' });
  }, []);

  const handleStaleRoot = useCallback(
    (rootId: string) => {
      void removeSupportThreadId(mxClient, userRoomId, supportRoomId, rootId).catch((err) =>
        console.warn('[SupportModal] failed to clean up stale thread', err),
      );
      setThreads((prev) => {
        const next = prev.filter((t) => t.id !== rootId);
        setSelectorMode({ kind: next.length > 0 || dmRooms.length > 0 ? 'list' : 'options' });
        return next;
      });
      toast.error('That conversation is no longer available.');
      setView({ kind: 'selector' });
    },
    [dmRooms.length, mxClient, supportRoomId, userRoomId],
  );

  const handleSendNew = useCallback(
    async (body: string) => {
      const text = body.trim();
      if (!text) return;
      setSending(true);
      try {
        const finalBody = `${SUPPORT_NEW_THREAD_PREAMBLE}\n\n${text}`;
        const rootId = await postThreadRoot(mxClient, supportRoomId, finalBody);
        const entry: SupportThreadEntry = {
          id: rootId,
          preview: buildSupportPreview(text),
          createdAt: Date.now(),
        };
        await appendSupportThreadId(mxClient, userRoomId, supportRoomId, rootId);
        setThreads((prev) => {
          const filtered = prev.filter((t) => t.id !== rootId);
          return [entry, ...filtered].slice(0, SUPPORT_THREAD_LIST_CAP);
        });
        const seedRoot: RawThreadEvent = {
          event_id: rootId,
          sender: ownerUserId,
          origin_server_ts: entry.createdAt,
          content: { msgtype: 'm.text', body: finalBody },
          type: 'm.room.message',
        };
        setSelectorMode({ kind: 'options' });
        openThread(rootId, seedRoot);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Could not send message.';
        console.error('[SupportModal] sendNewThread failed', err);
        toast.error(message);
      } finally {
        setSending(false);
      }
    },
    [mxClient, openThread, ownerUserId, supportRoomId, userRoomId],
  );

  const isCompose = view.kind === 'selector' && selectorMode.kind === 'compose';
  const isOptionsWithList =
    view.kind === 'selector' && selectorMode.kind === 'options' && hasAny;
  const showBackChevron = view.kind === 'thread' || view.kind === 'dm' || isCompose || isOptionsWithList;

  const onBack = useCallback(() => {
    if (view.kind === 'selector' && selectorMode.kind === 'compose') {
      setSelectorMode({ kind: 'options' });
      return;
    }
    if (view.kind === 'selector' && selectorMode.kind === 'options') {
      setSelectorMode({ kind: 'list' });
      return;
    }
    setSelectorMode({ kind: hasAny ? 'list' : 'options' });
    backToSelector();
  }, [backToSelector, hasAny, selectorMode.kind, view.kind]);

  const title = useMemo(() => {
    if (view.kind === 'thread') return 'Support conversation';
    if (view.kind === 'dm') return 'Support DM';
    return 'Contact support';
  }, [view]);

  const backChevronButton = showBackChevron ? (
    <button
      type='button'
      aria-label={isCompose ? 'Back to options' : 'Back to conversations'}
      onClick={onBack}
      style={backChevronButtonStyle}
    >
      <BackChevron />
    </button>
  ) : null;

  return (
    <Modal onClose={onClose} title={title} style={overlayCardStyle} leftAction={backChevronButton}>
      {view.kind === 'selector' && (
        <SupportSelectorView
          mode={selectorMode}
          onModeChange={setSelectorMode}
          threads={threads}
          dmRooms={dmRooms}
          profilesById={profilesById}
          sending={sending}
          threadUnread={threadUnread}
          dmUnread={dmUnread}
          onOpenThread={(id) => openThread(id)}
          onOpenDm={openDm}
          onSendNew={handleSendNew}
        />
      )}
      {view.kind === 'thread' && (
        <SupportThreadView
          mxClient={mxClient}
          supportRoomId={supportRoomId}
          rootId={view.rootId}
          ownerUserId={ownerUserId}
          profilesById={profilesById}
          seedRoot={view.seedRoot}
          onStaleRoot={handleStaleRoot}
          onObserveSenders={observeSenders}
          onMarkSeen={onMarkThreadSeen}
        />
      )}
      {view.kind === 'dm' && (
        <SupportDmView
          mxClient={mxClient}
          dmRoomId={view.roomId}
          adminUserId={view.adminUserId}
          ownerUserId={ownerUserId}
          profilesById={profilesById}
          onObserveSenders={observeSenders}
          onMarkSeen={onMarkDmSeen}
        />
      )}
    </Modal>
  );
}
