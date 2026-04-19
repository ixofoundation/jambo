import { useEffect, useState } from 'react';

import AuthGuard from '@components/AuthGuard';
import GradientBand from '@components/GradientBand/GradientBand';
import { GRADIENT_COLORS } from '@constants/gradientColors';
import { KYC_ENTITY_ID } from '@constants/kyc';
import { useAppDispatch, useAppSelector } from '@store/hooks';
import { loadKycForm } from '@store/thunks/kycThunks';
import CollectionForm from 'screens/collectionForm';

function CenteredMessage({ title, message }: { title: string; message: string }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        textAlign: 'center',
      }}
    >
      <GradientBand {...GRADIENT_COLORS.dashboard} />
      <div style={{ position: 'relative', zIndex: 1, maxWidth: '420px' }}>
        <h2 style={{ marginBottom: '12px' }}>{title}</h2>
        <p style={{ color: 'var(--text-secondary)' }}>{message}</p>
      </div>
    </div>
  );
}

function KycLoader() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16,
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            border: '3px solid var(--border-color)',
            borderTopColor: 'var(--accent-color)',
            borderRadius: '50%',
            animation: 'kycPageSpinner 0.8s linear infinite',
          }}
        />
        <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)' }}>
          Preparing KYC verification...
        </p>
        <style>{`
          @keyframes kycPageSpinner {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  );
}

function KycCredentialPageInner() {
  const dispatch = useAppDispatch();
  const protocolId = useAppSelector((s) => s.kyc.protocolId);
  const claimCollectionId = useAppSelector((s) => s.kyc.claimCollectionId);
  const surveyTemplate = useAppSelector((s) => s.kyc.surveyTemplate);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    dispatch(loadKycForm())
      .unwrap()
      .catch((err) => {
        const message = err instanceof Error ? err.message : String(err);
        setError(message || 'Failed to load KYC form');
      });
  }, [dispatch]);

  if (error) {
    return <CenteredMessage title="Unable to load KYC" message={error} />;
  }

  if (!protocolId || !claimCollectionId || !surveyTemplate) {
    return <KycLoader />;
  }

  return (
    <CollectionForm
      entityDid={protocolId}
      collectionId={claimCollectionId}
      formType="kyc"
      closeUrl="/profile"
    />
  );
}

export default function KycCredentialPage() {
  if (!KYC_ENTITY_ID) {
    return (
      <CenteredMessage
        title="KYC not configured"
        message="This deployment has no KYC protocol entity set. Please contact support."
      />
    );
  }

  return (
    <AuthGuard>
      <KycCredentialPageInner />
    </AuthGuard>
  );
}
