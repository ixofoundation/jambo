import { useCallback, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { toast } from 'react-toastify';

import Button, { BUTTON_BG_COLOR, BUTTON_BORDER_COLOR, BUTTON_COLOR, BUTTON_SIZE } from '@components/Button/Button';
import Loader from '@components/Loader/Loader';
import { KycStatus, isReadyToSave, isTerminalSuccess } from '@constants/kyc';
import { SELF_KYC_ENABLED } from '@constants/self';
import { BackgroundSetupContext } from '@contexts/backgroundSetup';
import { useAuth } from '@hooks/useAuth';
import { useKyc } from '@hooks/useKyc';
import { useLegacyKyc } from '@hooks/useLegacyKyc';
import { useAppDispatch } from '@store/hooks';
import { setRedirectedAt } from '@store/slices/kycSlice';
import { findIdentityLevel1IndexEntry } from '@utils/approvePayment';
import { type KycCardView, resolveKycCardView } from '@utils/kyc/legacyCheck';
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

const KYC_ROUTE = '/profile/credentials/kyc';

const VERIFIED_MESSAGE =
  'Your credential has been successfully issued and securely saved. \nYour verification is complete and no further action is required.';

/** The card's subtitle and message for every state but an old check in flight. */
const VIEW_COPY: Record<Exclude<KycCardView, 'legacy'>, { subtitle: string; message: string }> = {
  checking: { subtitle: 'Checking…', message: '' },
  verified: { subtitle: 'Verified', message: VERIFIED_MESSAGE },
  start: {
    subtitle: 'Get started',
    message: 'Some features need a verified identity. It takes a few minutes and you only need to do it once.',
  },
  pending: {
    subtitle: 'Check in progress',
    message: 'Your identity check is in progress. Open it to see where it stands or to continue.',
  },
  unavailable: {
    subtitle: 'Couldn’t check',
    message: 'We couldn’t check your identity verification. Please try again.',
  },
  not_available: { subtitle: 'Not available', message: 'Identity verification is not available right now.' },
};

// Old check only (ixo-kyc-server): maps each server status to a short user-facing description.
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

/** What an old check in flight asks of the person next. */
type LegacyStep = 'continue' | 'save' | 'refresh';

function legacyStep(status: KycStatus | undefined, saved: boolean): LegacyStep {
  if (status === KycStatus.Verify) return 'continue';
  // Issued: the app still has to save the credential to the Vault.
  if (isReadyToSave(status) && !saved) return 'save';
  return 'refresh';
}

export default function KycCredentialsCard() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { did, matrixRoomId } = useAuth();
  const { getMatrixClient } = useContext(BackgroundSetupContext);

  // The one "is this person verified" state, shared with the ramps.
  const kyc = useKyc();
  const kycRefresh = kyc.refresh;
  // The old check, only for a person known not to be verified.
  const legacy = useLegacyKyc(kyc.status !== 'checking' && !kyc.verified);
  const { protocolId } = legacy;

  const [redirectBusy, setRedirectBusy] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const { entityDid: supportEntityDid, loading: supportLoading, error: supportError } = useKycSupportEntityDid();

  const onSupportClickFallback = useCallback(() => {
    if (supportLoading) {
      toast.info('Loading support…');
      return;
    }
    toast.error(supportError || 'Support is not available right now.');
  }, [supportLoading, supportError]);

  // The old check ended with the credential saved: the Vault now holds it, so
  // re-read the shared state (it answers `legacy` and the card shows verified).
  const legacyDone =
    !!protocolId && kyc.status !== 'checking' && !kyc.verified && (isTerminalSuccess(legacy.status) || legacy.saved);
  const [legacyDoneConfirmed, setLegacyDoneConfirmed] = useState(false);
  useEffect(() => {
    if (!legacyDone) return;
    let cancelled = false;
    void kycRefresh().finally(() => {
      if (!cancelled) setLegacyDoneConfirmed(true);
    });
    return () => {
      cancelled = true;
    };
  }, [legacyDone, kycRefresh]);

  const view: KycCardView =
    legacyDone && !legacyDoneConfirmed
      ? 'checking'
      : resolveKycCardView({
          kycStatus: kyc.status,
          legacyInFlight: legacy.inFlight,
          legacyChecked: legacy.checked,
          selfEnabled: SELF_KYC_ENABLED,
        });

  // The Auth Hub copies the Self credential into the Vault; until that copy is
  // here there is nothing for the credential screen to open.
  const [selfCredentialCid, setSelfCredentialCid] = useState<string | null>(null);
  useEffect(() => {
    if (kyc.status !== 'self') {
      setSelfCredentialCid(null);
      return;
    }
    // An unencrypted index read: cheap enough to repeat.
    const read = () => {
      const mxClient = getMatrixClient();
      const entry = mxClient && matrixRoomId ? findIdentityLevel1IndexEntry(mxClient, matrixRoomId) : null;
      setSelfCredentialCid(entry?.cid || null);
      return !!entry?.cid;
    };
    // The copy may sync after the card first read it: look again when the
    // person comes back to the page, and after every `refresh()` (a new `kyc`).
    if (read()) return;
    const onReturn = () => {
      if (document.visibilityState !== 'hidden') read();
    };
    window.addEventListener('focus', onReturn);
    document.addEventListener('visibilitychange', onReturn);
    return () => {
      window.removeEventListener('focus', onReturn);
      document.removeEventListener('visibilitychange', onReturn);
    };
  }, [kyc, getMatrixClient, matrixRoomId]);

  const { saveCredential } = legacy;
  const onSaveClick = useCallback(() => {
    saveCredential().catch((err) => {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(`Could not save credential: ${message}`);
    });
  }, [saveCredential]);

  // Old check only: reopens the ComplyCube step of a check that was already started.
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

  const onOpenCheck = useCallback(() => {
    router.push(KYC_ROUTE);
  }, [router]);

  // The way out of an old check that is stalled or abandoned: leave it as it
  // is and do the new check. Not offered once the old credential is issued or
  // being issued (`legacy.canSkip`): that one is finished here.
  const { skip: skipLegacy } = legacy;
  const onUseNewCheck = useCallback(() => {
    skipLegacy();
    router.push(KYC_ROUTE);
  }, [router, skipLegacy]);

  const onRetry = useCallback(() => {
    setRetrying(true);
    void kycRefresh().finally(() => setRetrying(false));
  }, [kycRefresh]);

  // Navigate the "Verified" button straight to the most recently stored credential.
  // Falls back to the credentials list when nothing is found or matrix isn't ready.
  const onVerifiedClick = useCallback(() => {
    if (kyc.status === 'self') {
      if (selfCredentialCid) router.push(`/profile/credentials/${encodeURIComponent(selfCredentialCid)}`);
      return;
    }
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
  }, [getMatrixClient, kyc.status, matrixRoomId, router, selfCredentialCid]);

  if (!did) return null;

  const step = view === 'legacy' ? legacyStep(legacy.status, legacy.saved) : null;
  const subtitle = view === 'legacy' ? prettyStatus(legacy.status) : VIEW_COPY[view].subtitle;
  const message =
    view === 'legacy'
      ? legacy.saved && isReadyToSave(legacy.status)
        ? statusLabel(KycStatus.Complete)
        : statusLabel(legacy.status) || 'Your verification is in progress…'
      : VIEW_COPY[view].message;

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
            {subtitle}
          </span>
        </div>
        {/* Help lives here (not in the dock): visible until the credential is
            actually obtained — anyone still without it can reach support. The
            support room belongs to the KYC protocol entity, so it needs that id. */}
        {protocolId &&
          view !== 'verified' &&
          view !== 'checking' &&
          (supportEntityDid ? (
            <SupportLauncher entityDid={supportEntityDid} />
          ) : (
            <SupportIconButton onClick={onSupportClickFallback} />
          ))}
      </div>

      {view === 'checking' ? (
        <div role='status' style={{ display: 'flex', alignItems: 'center', gap: '10px', minHeight: '24px' }}>
          <Loader size={16} />
          <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Checking your verification…</span>
        </div>
      ) : (
        <p
          style={{
            margin: view === 'not_available' ? 0 : '0 0 16px',
            fontSize: '14px',
            lineHeight: 1.5,
            color: view === 'not_available' ? 'var(--text-secondary)' : 'var(--text-primary)',
            whiteSpace: 'pre-line',
          }}
        >
          {message}
        </p>
      )}

      {view === 'start' && (
        <Button
          label='Verify my identity'
          prefixIcon={<span>→</span>}
          onClick={onOpenCheck}
          bgColor={BUTTON_BG_COLOR.primary}
          borderColor={BUTTON_BORDER_COLOR.primary}
          color={BUTTON_COLOR.white}
          size={BUTTON_SIZE.mediumLarge}
          style={actionButtonStyle}
        />
      )}

      {view === 'pending' && (
        <Button
          label='Continue'
          prefixIcon={<span>→</span>}
          onClick={onOpenCheck}
          bgColor={BUTTON_BG_COLOR.primary}
          borderColor={BUTTON_BORDER_COLOR.primary}
          color={BUTTON_COLOR.white}
          size={BUTTON_SIZE.mediumLarge}
          style={actionButtonStyle}
        />
      )}

      {view === 'unavailable' && (
        <Button
          label={retrying ? 'Checking…' : 'Try again'}
          onClick={onRetry}
          disabled={retrying}
          bgColor={BUTTON_BG_COLOR.primary}
          borderColor={BUTTON_BORDER_COLOR.primary}
          color={BUTTON_COLOR.white}
          size={BUTTON_SIZE.mediumLarge}
          style={actionButtonStyle}
        />
      )}

      {step === 'continue' && (
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

      {step === 'refresh' && (
        <Button
          label={legacy.loading ? 'Checking…' : 'Refresh status'}
          onClick={() => void legacy.refresh()}
          disabled={legacy.loading}
          bgColor={BUTTON_BG_COLOR.primary}
          borderColor={BUTTON_BORDER_COLOR.primary}
          color={BUTTON_COLOR.white}
          size={BUTTON_SIZE.mediumLarge}
          style={actionButtonStyle}
        />
      )}

      {step === 'save' && (
        <Button
          label={legacy.saving ? 'Saving…' : 'Save Credential'}
          onClick={onSaveClick}
          disabled={legacy.saving}
          bgColor={BUTTON_BG_COLOR.primary}
          borderColor={BUTTON_BORDER_COLOR.primary}
          color={BUTTON_COLOR.white}
          size={BUTTON_SIZE.mediumLarge}
          style={actionButtonStyle}
        />
      )}

      {view === 'legacy' && SELF_KYC_ENABLED && legacy.canSkip && (
        <>
          <Button
            label='Use the new identity check instead'
            onClick={onUseNewCheck}
            color={BUTTON_COLOR.primary}
            borderColor={BUTTON_BORDER_COLOR.primary}
            size={BUTTON_SIZE.mediumLarge}
            style={{ ...actionButtonStyle, marginTop: '10px' }}
          />
          <p style={{ margin: '8px 0 0', fontSize: '12px', lineHeight: 1.5, color: 'var(--text-secondary)' }}>
            Your earlier check will be left as it is.
          </p>
        </>
      )}

      {view === 'verified' &&
        (kyc.status === 'self' && !selfCredentialCid ? (
          // Verified through the Auth Hub, but the Vault copy is not on this device (yet): nothing to open.
          <p
            style={{
              ...actionButtonStyle,
              margin: 0,
              textAlign: 'center',
              color: 'var(--green-primary)',
              border: '1px solid var(--border-color)',
              boxSizing: 'border-box',
            }}
          >
            ✓ Verified
          </p>
        ) : (
          <Button
            label='✓ Verified'
            onClick={onVerifiedClick}
            color={BUTTON_COLOR.primary}
            borderColor={BUTTON_BORDER_COLOR.primary}
            size={BUTTON_SIZE.mediumLarge}
            style={actionButtonStyle}
          />
        ))}

      {legacy.error && view === 'legacy' && (
        <p
          style={{
            marginTop: '12px',
            fontSize: '12px',
            color: 'var(--error-color)',
          }}
        >
          {legacy.error}
        </p>
      )}
    </div>
  );
}
