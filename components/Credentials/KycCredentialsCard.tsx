import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { toast } from 'react-toastify';

import { KYC_ENTITY_ID, KycStatus, isTerminalFailure, isTerminalSuccess } from '@constants/kyc';
import { useAuth } from '@hooks/useAuth';
import { useKycStatus } from '@hooks/useKycStatus';
import { useAppDispatch, useAppSelector } from '@store/hooks';
import { setRedirectedAt } from '@store/slices/kycSlice';
import { loadKycForm } from '@store/thunks/kycThunks';
import { fetchKycRedirect } from '@utils/kycServer';

const cardStyle = {
  backgroundColor: 'var(--bg-secondary)',
  borderRadius: '16px',
  border: '1px solid var(--border-color)',
  padding: '16px',
  marginBottom: '16px',
} as const;

const headerStyle = {
  margin: '0 0 16px',
  fontSize: '13px',
  fontWeight: 600,
  color: 'var(--text-secondary)',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.5px',
};

const primaryButtonStyle = {
  width: '100%',
  padding: '14px 16px',
  borderRadius: '10px',
  border: '1px solid var(--accent-color)',
  backgroundColor: 'var(--accent-color)',
  color: 'var(--text-primary-light)',
  cursor: 'pointer',
  fontSize: '14px',
  fontWeight: 500,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
};

const secondaryButtonStyle = {
  ...primaryButtonStyle,
  backgroundColor: 'transparent',
  border: '1px solid var(--border-color)',
  color: 'var(--text-primary)',
};

const solidAccentButtonStyle = {
  ...primaryButtonStyle,
  backgroundColor: 'var(--accent-color)',
  border: '1px solid var(--accent-color)',
  color: 'var(--text-primary-light)',
};

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

  const entry = useAppSelector((state) =>
    protocolId ? state.kyc.byProtocolId[protocolId] : undefined,
  );

  const status = entry?.status;
  const terminal = !!entry?.credentialSaved;

  const { loading, error, refresh } = useKycStatus({
    did,
    protocolId,
    address,
    enabled: !!did && !!protocolId && !terminal,
  });

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
    setRedirectBusy(true);
    try {
      const { url } = await fetchKycRedirect(did, protocolId);
      dispatch(setRedirectedAt({ protocolId, at: Date.now() }));
      window.open(url, '_blank', 'noopener,noreferrer');
      setRedirectBusy(false);
    } catch (err) {
      setRedirectBusy(false);
      const message = err instanceof Error ? err.message : String(err);
      toast.error(`Could not open verification: ${message}`);
    }
  }, [did, dispatch, protocolId]);

  const onAcquireClick = useCallback(() => {
    router.push('/profile/credentials/kyc');
  }, [router]);

  const view = useMemo(() => {
    if (isTerminalSuccess(status) && entry?.credentialSaved) {
      return {
        variant: 'success' as const,
        message: 'Your KYC Credential has been issued and saved.',
      };
    }

    if (isTerminalFailure(status)) {
      return {
        variant: 'failure' as const,
        message: statusLabel(status) || 'Your KYC verification could not be completed.',
      };
    }

    if (status === KycStatus.Verify && entry?.lastRedirectAt) {
      return {
        variant: 'verify-retry' as const,
        message: 'It looks like you haven’t finished verification yet.',
      };
    }

    if (status && status !== KycStatus.Verify && status !== KycStatus.Unknown) {
      return {
        variant: 'in-progress' as const,
        message: statusLabel(status) || 'KYC verification in progress…',
      };
    }

    return {
      variant: 'idle' as const,
      message: 'Some features require a KYC Credential',
    };
  }, [entry?.credentialSaved, entry?.lastRedirectAt, status]);

  if (!KYC_ENTITY_ID) return null;
  if (!did) return null;

  return (
    <div style={cardStyle}>
      <h3 style={headerStyle}>Credentials</h3>

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
        <button onClick={onAcquireClick} style={solidAccentButtonStyle}>
          <span>→</span>
          <span>Acquire Credential</span>
        </button>
      )}

      {view.variant === 'verify-retry' && (
        <button
          onClick={() => void redirectToWebview()}
          disabled={redirectBusy}
          style={{ ...primaryButtonStyle, opacity: redirectBusy ? 0.6 : 1 }}
        >
          <span>→</span>
          <span>{redirectBusy ? 'Opening…' : 'Continue verification'}</span>
        </button>
      )}

      {view.variant === 'in-progress' && (
        <button
          onClick={() => void refresh()}
          disabled={loading}
          style={{ ...secondaryButtonStyle, opacity: loading ? 0.6 : 1 }}
        >
          <span>{loading ? 'Checking…' : 'Refresh status'}</span>
        </button>
      )}

      {view.variant === 'failure' && (
        <button onClick={onAcquireClick} style={secondaryButtonStyle}>
          <span>Start over</span>
        </button>
      )}

      {view.variant === 'success' && (
        <div
          style={{
            padding: '12px',
            borderRadius: '10px',
            border: '1px solid var(--accent-color)',
            backgroundColor: 'var(--accent-color)',
            color: 'var(--text-primary-light)',
            fontSize: '14px',
            textAlign: 'center',
          }}
        >
          ✓ Verified
        </div>
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
