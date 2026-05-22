import { useRouter } from 'next/router';

import AuthGuard from '@components/AuthGuard';
import SupportNewThreadScreen from 'screens/supportNewThread';

function pickString(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export default function SupportNewThreadPage() {
  const router = useRouter();
  const entityDid = pickString(router.query.entityDid);
  const promptsKey = pickString(router.query.prompts);

  if (!router.isReady) return null;
  if (!entityDid) {
    void router.replace('/profile');
    return null;
  }

  return (
    <AuthGuard>
      <SupportNewThreadScreen entityDid={entityDid} promptsKey={promptsKey} />
    </AuthGuard>
  );
}
