import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { toast } from 'react-toastify';

import Button, { BUTTON_BG_COLOR, BUTTON_BORDER_COLOR, BUTTON_COLOR, BUTTON_SIZE } from '@components/Button/Button';
import { KYC_ENTITY_ID, KycStatus, isTerminalFailure, isTerminalSuccess } from '@constants/kyc';
import { useAuth } from '@hooks/useAuth';
import { useKycStatus } from '@hooks/useKycStatus';
import { useAppDispatch, useAppSelector } from '@store/hooks';
import { setRedirectedAt } from '@store/slices/kycSlice';
import { loadKycForm } from '@store/thunks/kycThunks';
import { fetchKycRedirect } from '@utils/kycServer';
import SupportIconButton from '@components/Support/SupportIconButton';
import SupportLauncher from '@components/Support/SupportLauncher';
import { useKycSupportEntityDid } from '@hooks/useKycSupportEntityDid';

const cardStyle = {
  backgroundColor: 'var(--bg-secondary)',
  borderRadius: '16px',
  border: '1px solid var(--border-color)',
  padding: '16px',
  marginBottom: '12px',
} as const;

const actionButtonStyle = {
  width: '100%',
  padding: '14px 16px',
  borderRadius: '10px',
  fontSize: '14px',
  fontWeight: 500,
  gap: '8px',
} as const;

function statusLabel(status?: KycStatus): string {
  switch (status) {
    case KycStatus.Verify:
      return 'Awaiting document scan & liveness check';
    case KycStatus.Review:
      return 'Reviewing your submission…';
    case KycStatus.Clear:
      return 'Checks cleared — preparing your credential…';
    case KycStatus.Authorizing:
      return 'Authorizing credential issuance…';
    case KycStatus.Authorized:
      return 'Authorized — issuing credential…';
    case KycStatus.Issuing:
      return 'Issuing your KYC credential…';
    case KycStatus.Issued:
    case KycStatus.Complete:
      return 'KYC Credential verified';
    case KycStatus.Rejected:
      return 'Verification was rejected';
    case KycStatus.Attention:
      return 'Verification needs manual review';
    case KycStatus.Unauthorized:
      return 'Credential authorization failed';
    case KycStatus.Error:
      return 'Something went wrong during verification';
    default:
      return '';
  }
}

export default function KycCredentialsCard() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { did, address } = useAuth();

  const protocolId = KYC_ENTITY_ID || null;
  const [redirectBusy, setRedirectBusy] = useState(false);
  const {
    entityDid: supportEntityDid,
    loading: supportLoading,
    error: supportError,
  } = useKycSupportEntityDid();

  const onSupportClickFallback = useCallback(() => {
    if (supportLoading) {
      toast.info('Loading support…');
      return;
    }
    toast.error(supportError || 'Support is not available right now.');
  }, [supportLoading, supportError]);

  const entry = useAppSelector((state) => (protocolId ? state.kyc.byProtocolId[protocolId] : undefined));

  const status = entry?.status;
  const stopPolling = isTerminalSuccess(status) || isTerminalFailure(status);

  const { loading, saving, saved, error, refresh, saveCredential } = useKycStatus({
    did,
    protocolId,
    address,
    enabled: !!did && !!protocolId && !stopPolling,
  });

  const onSaveClick = useCallback(() => {
    saveCredential().catch((err) => {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(`Could not save credential: ${message}`);
    });
  }, [saveCredential]);

  useEffect(() => {
    if (!did || !protocolId) return;
    dispatch(loadKycForm())
      .unwrap()
      .catch(() => {
        // silent — the KYC page will surface the error if the user navigates there
      });
  }, [dispatch, did, protocolId]);

  const redirectToWebview = useCallback(async () => {
    if (!did || !protocolId) return;
    // Open the tab synchronously within the user gesture so Safari doesn't
    // block it. We can't use 'noopener' here because then window.open returns
    // null and we lose the handle we need to navigate it once the URL arrives.
    const newTab = window.open('about:blank', '_blank');
    setRedirectBusy(true);
    try {
      const { url } = await fetchKycRedirect(did, protocolId);
      dispatch(setRedirectedAt({ protocolId, at: Date.now() }));
      if (newTab && !newTab.closed) {
        newTab.opener = null;
        newTab.location.replace(url);
      } else {
        window.location.href = url;
      }
    } catch (err) {
      newTab?.close();
      const message = err instanceof Error ? err.message : String(err);
      toast.error(`Could not open verification: ${message}`);
    } finally {
      setRedirectBusy(false);
    }
  }, [did, dispatch, protocolId]);

  const onAcquireClick = useCallback(() => {
    router.push('/profile/credentials/kyc');
  }, [router]);

  const view = useMemo(() => {
    if (isTerminalSuccess(status) && saved) {
      return {
        variant: 'success' as const,
        message: 'Your KYC Credential has been issued and saved.',
      };
    }

    if (isTerminalSuccess(status)) {
      return {
        variant: 'ready-to-save' as const,
        message: 'Your KYC Credential is ready. Save it to your secure data store.',
      };
    }

    if (isTerminalFailure(status)) {
      const baseMessage = statusLabel(status) || 'Your KYC verification could not be completed.';
      return {
        variant: 'failure' as const,
        message: `${baseMessage} Please contact support to review the issue.`,
      };
    }

    if (status === KycStatus.Verify) {
      return {
        variant: 'verify-retry' as const,
        message: entry?.lastRedirectAt
          ? 'It looks like you haven’t finished verification yet.'
          : 'Next step: complete your document scan & liveness check.',
      };
    }

    if (status && status !== KycStatus.Unknown) {
      return {
        variant: 'in-progress' as const,
        message: statusLabel(status) || 'KYC verification in progress…',
      };
    }

    return {
      variant: 'idle' as const,
      message: 'Some features require a KYC Credential',
    };
  }, [entry?.lastRedirectAt, saved, status]);

  if (!KYC_ENTITY_ID) return null;
  if (!did) return null;

  return (
    <div style={cardStyle}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          margin: '0 0 16px',
          color: 'var(--text-primary)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          <svg
            width='18'
            height='18'
            viewBox='0 0 24 24'
            fill='none'
            stroke='currentColor'
            strokeWidth='2'
            strokeLinecap='round'
            strokeLinejoin='round'
          >
            <circle cx='12' cy='8' r='4' />
            <path d='M20 21a8 8 0 1 0-16 0' />
          </svg>
          <span style={{ fontSize: '14px', fontWeight: 600, lineHeight: 1.5 }}>Identity Credential</span>
        </div>
        {protocolId &&
          view.variant !== 'idle' &&
          view.variant !== 'success' &&
          (supportEntityDid ? (
            <SupportLauncher entityDid={supportEntityDid} />
          ) : (
            <SupportIconButton onClick={onSupportClickFallback} />
          ))}
      </div>

      <p
        style={{
          margin: '0 0 16px',
          fontSize: '14px',
          lineHeight: 1.5,
          color: 'var(--text-primary)',
        }}
      >
        {view.message}
      </p>

      {view.variant === 'idle' && (
        <Button
          label='Acquire Credential'
          prefixIcon={<span>→</span>}
          onClick={onAcquireClick}
          bgColor={BUTTON_BG_COLOR.primary}
          borderColor={BUTTON_BORDER_COLOR.primary}
          color={BUTTON_COLOR.white}
          size={BUTTON_SIZE.mediumLarge}
          style={actionButtonStyle}
        />
      )}

      {view.variant === 'verify-retry' && (
        <Button
          label={redirectBusy ? 'Opening…' : 'Continue verification'}
          prefixIcon={<span>→</span>}
          onClick={() => void redirectToWebview()}
          disabled={redirectBusy}
          bgColor={BUTTON_BG_COLOR.primary}
          borderColor={BUTTON_BORDER_COLOR.primary}
          color={BUTTON_COLOR.white}
          size={BUTTON_SIZE.mediumLarge}
          style={actionButtonStyle}
        />
      )}

      {view.variant === 'in-progress' && (
        <Button
          label={loading ? 'Checking…' : 'Refresh status'}
          onClick={() => void refresh()}
          disabled={loading}
          bgColor={BUTTON_BG_COLOR.primary}
          borderColor={BUTTON_BORDER_COLOR.primary}
          color={BUTTON_COLOR.white}
          size={BUTTON_SIZE.mediumLarge}
          style={actionButtonStyle}
        />
      )}

      {view.variant === 'failure' && (
        <Button
          label={loading ? 'Checking…' : 'Refresh'}
          onClick={() => void refresh()}
          disabled={loading}
          bgColor={BUTTON_BG_COLOR.primary}
          borderColor={BUTTON_BORDER_COLOR.primary}
          color={BUTTON_COLOR.white}
          size={BUTTON_SIZE.mediumLarge}
          style={actionButtonStyle}
        />
      )}

      {view.variant === 'ready-to-save' && (
        <Button
          label={saving ? 'Saving…' : 'Save Credential'}
          onClick={onSaveClick}
          disabled={saving}
          bgColor={BUTTON_BG_COLOR.primary}
          borderColor={BUTTON_BORDER_COLOR.primary}
          color={BUTTON_COLOR.white}
          size={BUTTON_SIZE.mediumLarge}
          style={actionButtonStyle}
        />
      )}

      {view.variant === 'success' && (
        <Button
          label='✓ Verified'
          disabled
          color={BUTTON_COLOR.primary}
          borderColor={BUTTON_BORDER_COLOR.primary}
          size={BUTTON_SIZE.mediumLarge}
          style={actionButtonStyle}
        />
      )}

      {error && view.variant !== 'idle' && (
        <p
          style={{
            marginTop: '12px',
            fontSize: '12px',
            color: 'var(--error-color)',
          }}
        >
          {error}
        </p>
      )}

    </div>
  );
}
