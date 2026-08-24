import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { toast } from 'react-toastify';

import Button, { BUTTON_BG_COLOR, BUTTON_BORDER_COLOR, BUTTON_COLOR, BUTTON_SIZE } from '@components/Button/Button';
import { KYC_ENTITY_ID, KycStatus, isReadyToSave, isTerminalFailure, isTerminalSuccess } from '@constants/kyc';
import { BackgroundSetupContext } from '@contexts/backgroundSetup';
import { useAuth } from '@hooks/useAuth';
import { useKycStatus } from '@hooks/useKycStatus';
import { useAppDispatch, useAppSelector } from '@store/hooks';
import { setRedirectedAt } from '@store/slices/kycSlice';
import { loadKycForm } from '@store/thunks/kycThunks';
import { fetchKycRedirect } from '@utils/kycServer';
import { readAllCredentialIndexEntries } from '@utils/matrixCredential';
import SupportIconButton from '@components/Support/SupportIconButton';
import SupportLauncher from '@components/Support/SupportLauncher';
import { useKycSupportEntityDid } from '@hooks/useKycSupportEntityDid';

const cardStyle = {
  backgroundColor: 'var(--bg-secondary)',
  borderRadius: '12px',
  padding: '16px',
  marginBottom: '12px',
} as const;

const iconBoxStyle = {
  width: '32px',
  height: '32px',
  borderRadius: '50%',
  backgroundColor: 'var(--bg-primary)',
  color: 'var(--text-primary)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flex: '0 0 auto',
} as const;

// Maps each KYC AML server status to a short user-facing description. Includes whether the user
// needs to do anything next. `undefined` is treated as "no KYC started yet".
function prettyStatus(status?: KycStatus | null): string {
  switch (status) {
    case KycStatus.Verify:
      return 'Verification pending';
    case KycStatus.Review:
      return 'Under review';
    case KycStatus.Clear:
      return 'Approved';
    case KycStatus.Rejected:
      return 'Rejected';
    case KycStatus.Attention:
      return 'Manual review';
    case KycStatus.Issuing:
      return 'Issuing credential';
    case KycStatus.Issued:
      return 'Credential issued';
    case KycStatus.Error:
      return 'Verification error';
    case KycStatus.Complete:
      return 'Verified';
    case KycStatus.Unknown:
      return 'Status unavailable';
    default:
      return 'Get started';
  }
}

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
      return 'Awaiting document scan & liveness check. Press the button below to begin verification in your browser. \nFor best results, ensure you are in good lighting, your camera lens is clean, and follow the verification instructions carefully.';
    case KycStatus.Review:
      return 'Your verification review is in progress. Reviews are usually completed within a few minutes. \nIf you experience unusual delays, please contact support.';
    case KycStatus.Clear:
      return 'Your verification checks have been approved. Your credential is now being issued and will be available shortly. \nIf you experience unusual delays, please contact support.';
    case KycStatus.Issuing:
      return 'Your identity credential is being issued and will be shared with you shortly. \nIf you experience unusual delays, please contact support.';
    case KycStatus.Issued:
      return 'Your credential has been issued and is ready to save. Press the button below to securely store it. \nIf you experience any problems, please contact support.';
    case KycStatus.Complete:
      return 'Your credential has been successfully issued and securely saved. \nYour verification is complete and no further action is required.';
    case KycStatus.Rejected:
      return 'One or more of your verification checks could not be completed successfully. \nPlease contact support for assistance resolving this issue.';
    case KycStatus.Attention:
      return 'One or more of your verification checks require manual review. Our team will review your submission in due course. \nIf you experience unusual delays, please contact support.';
    case KycStatus.Error:
      return 'We encountered an issue during your verification process and are working to resolve it. \nIf you experience unusual delays, please contact support.';
    case KycStatus.Unknown:
      return 'Verification status unavailable';
    default:
      return '';
  }
}

export default function KycCredentialsCard() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { did, address, matrixRoomId } = useAuth();
  const { getMatrixClient } = useContext(BackgroundSetupContext);

  const protocolId = KYC_ENTITY_ID || null;
  const [redirectBusy, setRedirectBusy] = useState(false);
  const { entityDid: supportEntityDid, loading: supportLoading, error: supportError } = useKycSupportEntityDid();

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

  // Navigate the "Verified" button straight to the most recently stored credential.
  // Falls back to the credentials list when nothing is found or matrix isn't ready.
  const onVerifiedClick = useCallback(() => {
    const mxClient = getMatrixClient();
    if (!mxClient || !matrixRoomId) {
      router.push('/profile/credentials');
      return;
    }
    const entries = readAllCredentialIndexEntries(mxClient, matrixRoomId);
    const latest = [...entries].sort((a, b) => (b.storedAt || '').localeCompare(a.storedAt || ''))[0];
    if (latest?.cid) {
      router.push(`/profile/credentials/${encodeURIComponent(latest.cid)}`);
    } else {
      router.push('/profile/credentials');
    }
  }, [getMatrixClient, matrixRoomId, router]);

  const view = useMemo(() => {
    if (isTerminalSuccess(status)) {
      return {
        variant: 'success' as const,
        message: statusLabel(KycStatus.Complete),
      };
    }

    if (isReadyToSave(status) || (saved && status === KycStatus.Issued)) {
      // Server has issued the credential; the client still has to save it to the matrix room.
      // Once saved, the server transitions to Complete on its next poll. Keep showing
      // ready-to-save here even if local `saved` flipped, in case the next poll hasn't landed.
      return {
        variant: saved ? ('success' as const) : ('ready-to-save' as const),
        message: saved ? statusLabel(KycStatus.Complete) : statusLabel(KycStatus.Issued),
      };
    }

    if (isTerminalFailure(status)) {
      return {
        variant: 'failure' as const,
        message: statusLabel(status) || 'Your KYC verification could not be completed.',
      };
    }

    if (status === KycStatus.Verify) {
      return {
        variant: 'verify-retry' as const,
        message: statusLabel(KycStatus.Verify),
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
      message: 'Some features require a KYC Credential. Press the button below to begin verification.',
    };
  }, [saved, status]);

  if (!KYC_ENTITY_ID) return null;
  if (!did) return null;

  return (
    <div style={cardStyle}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          margin: '0 0 16px',
          color: 'var(--text-primary)',
        }}
      >
        <div style={iconBoxStyle}>
          <svg
            width='16'
            height='16'
            viewBox='0 0 24 24'
            fill='none'
            stroke='currentColor'
            strokeWidth='2'
            strokeLinecap='round'
            strokeLinejoin='round'
            aria-hidden='true'
          >
            <circle cx='12' cy='8' r='4' />
            <path d='M20 21a8 8 0 1 0-16 0' />
          </svg>
        </div>
        <div style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '15px', fontWeight: 500, lineHeight: 1.25 }}>Identity Credential</span>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary, #777)', lineHeight: 1.25, marginTop: '2px' }}>
            {prettyStatus(status)}
          </span>
        </div>
        {/* Help lives here (not in the dock): visible until the credential is
            actually obtained — anyone still without it can reach support. */}
        {protocolId &&
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
          whiteSpace: 'pre-line',
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
          onClick={onVerifiedClick}
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
