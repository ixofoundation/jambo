import AuthGuard from '@components/AuthGuard';
import SelfKycScreen from 'screens/selfKyc';

/** The identity check (Self). The old SurveyJS + ComplyCube form that lived here can no longer be started. */
export default function KycCredentialPage() {
  return (
    <AuthGuard>
      <SelfKycScreen />
    </AuthGuard>
  );
}
