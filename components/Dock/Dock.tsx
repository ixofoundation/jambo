import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

import { useAuth } from '@hooks/useAuth';
import { useKycSupportEntityDid } from '@hooks/useKycSupportEntityDid';
import { useVaultGate } from '@hooks/useVaultGate';
import { ChevronUpIcon, HandshakeIcon, LayersIcon, LifeBuoyIcon, UserRoundIcon, WalletIcon } from '@components/Icons/icons';

const ITEMS = [
  { to: '/', label: 'Deck', icon: LayersIcon, match: (p: string) => p === '/' || p.startsWith('/entities') },
  { to: '/tasks', label: 'Tasks', icon: HandshakeIcon, match: (p: string) => p.startsWith('/tasks') },
  {
    to: '/wallet',
    label: 'Wallet',
    icon: WalletIcon,
    match: (p: string) => p.startsWith('/wallet') || p.startsWith('/profile/onramp') || p.startsWith('/profile/offramp'),
  },
  {
    to: '/profile',
    label: 'Profile',
    icon: UserRoundIcon,
    match: (p: string) => (p.startsWith('/profile') && !p.startsWith('/profile/onramp') && !p.startsWith('/profile/offramp')) || p.startsWith('/settings'),
  },
] as const;

/** Routes where navigation chrome would fight the surface (mid-flow wizards,
 *  chat composers pinned to the bottom of the screen). */
const HIDDEN_ON = [
  /^\/auth/,
  /^\/entities\/[^/]+\/claimCollections\/[^/]+\/(vct|bco|bev|kyc)/,
  /^\/profile\/credentials\/kyc\b/,
  /^\/profile\/support\/[^/]+\/(thread|new|dm)\b/,
];

/**
 * v2 shell: content owns the screen; navigation is summoned from a pill
 * (designer's dock-on-peek pattern). Fixed to the bottom of the viewport,
 * centred with the app column.
 */
export default function Dock() {
  const [open, setOpen] = useState(false);
  // Resolved before the dock ever opens (see SupportEntityWarmer) so the item
  // set never changes while the dock is visible — no mid-open reflow.
  const [helpEntityDid, setHelpEntityDid] = useState<string | null>(null);
  const router = useRouter();
  const { isLoggedIn } = useAuth();
  // Hidden while the Vault is opening — the deck shows its loading state and
  // navigation would only lead to screens about to be reshaped by hydration.
  const { pending: vaultPending } = useVaultGate();
  const path = router.asPath.split('?')[0];

  // Close the dock on any navigation.
  useEffect(() => {
    setOpen(false);
  }, [path]);

  if (!isLoggedIn) return null;
  if (HIDDEN_ON.some((re) => re.test(path))) return null;

  const active = ITEMS.find((i) => i.match(path));

  const go = (to: string) => {
    setOpen(false);
    router.push(to);
  };

  return (
    <>
      <SupportEntityWarmer onResolved={setHelpEntityDid} />

      {!vaultPending && open && (
        <>
          <button className='dock-scrim anim-fade' aria-label='Close navigation' onClick={() => setOpen(false)} />
          <nav className='dock dock--in' aria-label='Navigation'>
            <div className='dock__grid'>
              {ITEMS.map(({ to, label, icon: IconCmp, match }) => (
                <button key={to} className={`dock__item${match(path) ? ' is-active' : ''}`} onClick={() => go(to)}>
                  <IconCmp size={22} strokeWidth={match(path) ? 2.4 : 2} />
                  {label}
                </button>
              ))}
              {helpEntityDid && (
                <button className='dock__item' onClick={() => go(`/profile/support/${encodeURIComponent(helpEntityDid)}`)}>
                  <LifeBuoyIcon size={22} />
                  Help
                </button>
              )}
            </div>
          </nav>
        </>
      )}

      {!vaultPending && !open && (
        <button className='dock-pill' aria-label='Open navigation' onClick={() => setOpen(true)}>
          <ChevronUpIcon size={16} />
          {active?.label ?? 'Menu'}
        </button>
      )}
    </>
  );
}

/**
 * Resolves the entity-scoped support chat destination while the dock is still
 * closed. Renders nothing; only reports the resolved DID up so Help is either
 * present from the first frame the dock opens, or absent entirely.
 */
function SupportEntityWarmer({ onResolved }: { onResolved: (did: string | null) => void }) {
  const { entityDid } = useKycSupportEntityDid();
  useEffect(() => {
    onResolved(entityDid ?? null);
  }, [entityDid, onResolved]);
  return null;
}
