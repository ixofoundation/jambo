import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { toast } from 'react-toastify';
import type { MatrixClient } from 'matrix-js-sdk';

import Header from '@components/Header/Header';
import {
  SUPPORT_NEW_THREAD_PREAMBLE,
  SUPPORT_QUICK_MESSAGES_BY_PROMPT,
} from '@constants/support';
import { useSupportInit } from '@hooks/useSupportInit';
import { appendSupportThreadId, postThreadRoot } from 'lib/matrix/support';

import ChatInput from '@components/Support/parts/ChatInput';
import PrivacyAlert from '@components/Support/parts/PrivacyAlert';
import { conversationListBoxStyle, conversationListRowStyle } from '@components/Support/styles';
import SupportLoadingView from '@components/Support/views/SupportLoadingView';
import SupportErrorView from '@components/Support/views/SupportErrorView';

type SupportNewThreadScreenProps = {
  entityDid: string;
  promptsKey?: string;
};

function resolveQuickMessages(key?: string): readonly string[] {
  if (!key) return [];
  return (SUPPORT_QUICK_MESSAGES_BY_PROMPT as Record<string, readonly string[]>)[key] ?? [];
}

function buildRouteSuffix(promptsKey?: string): string {
  return promptsKey ? `?prompts=${encodeURIComponent(promptsKey)}` : '';
}

export default function SupportNewThreadScreen({ entityDid, promptsKey }: SupportNewThreadScreenProps) {
  const router = useRouter();
  const init = useSupportInit(entityDid);
  const quickMessages = useMemo(() => resolveQuickMessages(promptsKey), [promptsKey]);

  const goBack = useCallback(() => {
    if (window.history.length > 1) {
      router.back();
    } else {
      void router.push(`/profile/support/${encodeURIComponent(entityDid)}${buildRouteSuffix(promptsKey)}`);
    }
  }, [entityDid, promptsKey, router]);

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <Header onGradient title='New Support Thread' onBack={goBack} />

      <main
        style={{
          width: '100%',
          maxWidth: 'var(--max-width)',
          margin: '0 auto',
          padding: '0 20px 16px',
          paddingTop: 'calc(var(--header-height) + 4px)',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
        }}
      >
        {/* Privacy note leads the new-thread flow on the light ground. */}
        <PrivacyAlert />

        {init.kind === 'loading' && <SupportLoadingView />}
        {init.kind === 'error' && <SupportErrorView message={init.message} onClose={goBack} />}
        {init.kind === 'ready' && (
          <ReadyNewThread
            mxClient={init.mxClient}
            supportRoomId={init.supportRoomId}
            userRoomId={init.userRoomId}
            entityDid={entityDid}
            promptsKey={promptsKey}
            quickMessages={quickMessages}
          />
        )}
      </main>
    </div>
  );
}

type ReadyProps = {
  mxClient: MatrixClient;
  supportRoomId: string;
  userRoomId: string;
  entityDid: string;
  promptsKey?: string;
  quickMessages: readonly string[];
};

function ReadyNewThread({ mxClient, supportRoomId, userRoomId, entityDid, promptsKey, quickMessages }: ReadyProps) {
  const router = useRouter();
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  const sendNew = useCallback(async () => {
    const text = body.trim();
    if (!text) return;
    setSending(true);
    try {
      const finalBody = `${SUPPORT_NEW_THREAD_PREAMBLE}\n\n${text}`;
      const rootId = await postThreadRoot(mxClient, supportRoomId, finalBody);
      await appendSupportThreadId(mxClient, userRoomId, supportRoomId, rootId);
      // Replace, not push — the just-created thread takes the place of this screen so the back
      // button skips the (now empty) compose state and returns straight to the selector.
      const suffix = buildRouteSuffix(promptsKey);
      void router.replace(
        `/profile/support/${encodeURIComponent(entityDid)}/thread/${encodeURIComponent(rootId)}${suffix}`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not send message.';
      console.error('[SupportNewThreadScreen] send failed', err);
      toast.error(message);
      setSending(false);
    }
  }, [body, entityDid, mxClient, promptsKey, router, supportRoomId, userRoomId]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {/* Spacer pushes the chips + input to the bottom of the screen. */}
      <div style={{ flex: 1, minHeight: 0 }} />

      {quickMessages.length > 0 && (
        <div style={{ paddingBottom: '12px' }}>
          <p
            className='muted'
            style={{
              margin: '0 0 8px',
              fontSize: '13px',
              fontWeight: 600,
            }}
          >
            Pick a starter or write your own:
          </p>
          <div style={conversationListBoxStyle}>
            {quickMessages.map((msg, idx) => {
              const isLast = idx === quickMessages.length - 1;
              return (
                <button
                  key={msg}
                  type='button'
                  onClick={() => setBody(msg)}
                  disabled={sending}
                  style={isLast ? { ...conversationListRowStyle, borderBottom: 'none' } : conversationListRowStyle}
                >
                  <span style={{ minWidth: 0, flex: 1 }}>{msg}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <ChatInput
        value={body}
        onChange={setBody}
        onSend={() => void sendNew()}
        placeholder='Describe what you need help with…'
        sendAriaLabel='Send new support thread'
        sending={sending}
        autoFocus
      />
    </div>
  );
}
