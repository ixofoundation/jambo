import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/router';

import { useAppSelector } from '@store/hooks';
import { useAuth } from '@hooks/useAuth';
import { useVaultGate } from '@hooks/useVaultGate';
import { loadWhitelistedEntities } from '@utils/projects';
import { ensureEntityProfiles } from '@utils/entityProfiles';
import {
  activateDeckPrefs,
  getSaved,
  getSkipped,
  isDeckTutorialDone,
  restoreAllSkipped,
  restoreCard,
  saveCard,
  setDeckTutorialDone,
  skipCard,
  subscribeDeckPrefs,
} from '@utils/deckPrefs';
import DeckCard, { DeckCardData, SwipeDir } from '@components/Deck/DeckCard';
import { YomaWordmark } from '@components/Brand/YomaWordmark';
import {
  ArrowRightIcon,
  ArrowUpIcon,
  BadgeCheckIcon,
  BookmarkIcon,
  RotateCcwIcon,
  SparklesIcon,
  UserRoundIcon,
  UserRoundPlusIcon,
  XIcon,
} from '@components/Icons/icons';

function readableType(type?: string): string {
  if (!type) return '';
  const last = type.split('/').pop() || '';
  return last.charAt(0).toUpperCase() + last.slice(1);
}

/** v2 home: the deck. One decision at a time, on real whitelisted opportunities. */
const VAULT_ACK_KEY = 'yoma_vault_failed_ack';

export default function Deck() {
  const router = useRouter();
  const { address, logout } = useAuth();
  const { pending: vaultPending, failed: vaultFailed, hydrated: prefsHydrated } = useVaultGate();
  const projectIds = useAppSelector((state) => state.projects.ids);
  const profiles = useAppSelector((state) => state.profiles.byEntityDid);
  const avatarUrl = useAppSelector((state) => state.matrixProfile.avatarUrl);

  const [loading, setLoading] = useState(true);
  const [tutorialDone, setTutorialDone] = useState(true); // corrected on mount (SSR-safe)
  const [saved, setSaved] = useState<string[]>([]);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [vaultAck, setVaultAck] = useState(
    () => typeof window !== 'undefined' && window.sessionStorage.getItem(VAULT_ACK_KEY) === '1',
  );
  const [sheet, setSheet] = useState<null | 'detail' | 'saved'>(null);
  // Bound to a card id so a state update can never leak the exit onto the next card.
  const [forced, setForced] = useState<{ id: string; dir: SwipeDir } | null>(null);
  const decided = useRef(new Set<string>());

  useEffect(() => {
    // Prefs are per-account, mirrored locally, and live-updated when Matrix
    // hydration (or another device) changes them — see utils/deckPrefs.
    activateDeckPrefs(address);
    const syncFromPrefs = () => {
      setTutorialDone(isDeckTutorialDone());
      setSaved(getSaved());
      setSkipped(getSkipped());
    };
    syncFromPrefs();
    const unsubscribe = subscribeDeckPrefs(syncFromPrefs);
    let cancelled = false;
    void loadWhitelistedEntities()
      .then((ids) => ensureEntityProfiles(ids))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [address]);

  // A fresh session that recovered its Vault clears any old "continue without" choice.
  useEffect(() => {
    if (prefsHydrated) {
      try {
        window.sessionStorage.removeItem(VAULT_ACK_KEY);
      } catch {
        // best-effort
      }
    }
  }, [prefsHydrated]);

  const continueWithoutVault = () => {
    try {
      window.sessionStorage.setItem(VAULT_ACK_KEY, '1');
    } catch {
      // best-effort
    }
    setVaultAck(true);
  };

  const cards: DeckCardData[] = useMemo(() => {
    const out = new Set([...saved, ...skipped]);
    return projectIds
      .filter((id) => !out.has(id))
      .map((id) => {
        const p = profiles[id];
        return {
          id,
          title: p?.name || 'Opportunity',
          provider: p?.brand ? `${p.brand} · Verified` : 'Verified partner',
          image: p?.image || p?.logo,
          logoOnly: !p?.image && !!p?.logo,
          typeLabel: readableType(p?.type),
          location: p?.location,
        };
      });
  }, [projectIds, profiles, saved, skipped]);

  const top = cards[0];

  // A card brought back from Saved/Passed is decidable again.
  useEffect(() => {
    cards.forEach((c) => decided.current.delete(c.id));
  }, [cards]);

  const decide = (dir: SwipeDir) => {
    if (!top || decided.current.has(top.id)) return;
    decided.current.add(top.id);
    setForced(null);
    if (dir === 'apply') {
      // The real apply flow lives on the opportunity itself.
      router.push(`/entities/${encodeURIComponent(top.id)}`);
      return;
    }
    if (dir === 'save') setSaved(saveCard(top.id));
    if (dir === 'skip') setSkipped(skipCard(top.id));
  };

  const buttonDecide = (dir: SwipeDir) => {
    if (!top || decided.current.has(top.id) || !tutorialDone || vaultPending) return;
    setForced({ id: top.id, dir });
  };

  // Desktop: arrow keys mirror the swipe grammar (← pass, → open, ↑ save).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (sheet || !tutorialDone || vaultPending) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        buttonDecide('apply');
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        buttonDecide('skip');
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        buttonDecide('save');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheet, tutorialDone, vaultPending, top?.id]);

  const finishTutorial = () => {
    setDeckTutorialDone();
    setTutorialDone(true);
  };

  const restore = (id: string) => {
    const next = restoreCard(id);
    setSaved(next.saved);
    setSkipped(next.skipped);
  };

  const savedCards = projectIds.filter((id) => saved.includes(id));
  const skippedCards = projectIds.filter((id) => skipped.includes(id));

  return (
    <div className='screen'>
      <div className='deck'>
        <header className='deck__header'>
          <YomaWordmark height={22} />
          <div className='topbar__actions'>
            <button
              className='iconbtn'
              aria-label={`Saved cards (${saved.length})`}
              onClick={() => setSheet('saved')}
              style={saved.length ? { color: 'var(--warning-color)' } : undefined}
            >
              <BookmarkIcon size={19} />
              {saved.length > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: -2,
                    right: -2,
                    minWidth: 17,
                    height: 17,
                    borderRadius: 9,
                    background: 'var(--yellow-primary)',
                    color: '#3d2c07',
                    fontSize: 11.5,
                    fontWeight: 800,
                    display: 'grid',
                    placeItems: 'center',
                    padding: '0 4px',
                    border: '2px solid var(--bg-primary)',
                  }}
                >
                  {saved.length}
                </span>
              )}
            </button>
            <button className='iconbtn' aria-label='Profile' onClick={() => router.push('/profile')}>
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt='' style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover' }} />
              ) : (
                <UserRoundIcon size={19} />
              )}
            </button>
          </div>
        </header>

        <div className='deck__stage'>
          {vaultPending && (
            <div className='deck-empty'>
              <div>
                <div
                  style={{
                    width: 38,
                    height: 38,
                    border: '3px solid var(--border-color)',
                    borderTopColor: 'var(--purple-primary)',
                    borderRadius: '50%',
                    animation: 'deckVaultSpin 0.8s linear infinite',
                    margin: '0 auto 14px',
                  }}
                />
                <h2 className='h2' style={{ marginBottom: 8 }}>
                  Opening your Vault…
                </h2>
                <p className='muted' style={{ fontSize: 14.5, lineHeight: 1.5, maxWidth: 240, margin: '0 auto' }}>
                  Syncing your saved cards and progress.
                </p>
                <style>{`@keyframes deckVaultSpin { to { transform: rotate(360deg); } }`}</style>
              </div>
            </div>
          )}

          {!vaultPending && !tutorialDone && (
            <div
              className='deck-card'
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                padding: 28,
                zIndex: 5,
                background: 'var(--surface)',
              }}
            >
              <SparklesIcon size={26} color='var(--warning-color)' />
              <h2 className='deck-card__title' style={{ fontSize: 30, margin: '14px 0 6px', color: 'var(--text-primary)' }}>
                Your next move is a swipe away.
              </h2>
              <p className='muted' style={{ fontSize: 15, lineHeight: 1.55, margin: 0 }}>
                Each card is a real opportunity from a verified partner — completing it grows your verified CV.
              </p>
              <div style={{ marginTop: 22, display: 'flex', flexDirection: 'column', gap: 12, fontSize: 14.5, fontWeight: 600 }}>
                <span className='hstack' style={{ gap: 10 }}>
                  <span className='badge badge--match'>
                    <UserRoundPlusIcon size={13} />
                  </span>
                  Swipe right to open &amp; apply
                </span>
                <span className='hstack' style={{ gap: 10 }}>
                  <span className='badge' style={{ background: '#fde7e7', color: 'var(--error-color)' }}>
                    <XIcon size={13} />
                  </span>
                  Swipe left to pass
                </span>
                <span className='hstack' style={{ gap: 10 }}>
                  <span className='badge' style={{ background: '#fdeed8', color: 'var(--warning-color)' }}>
                    <ArrowUpIcon size={13} />
                  </span>
                  Swipe up to save · tap for details
                </span>
              </div>
              <p className='muted' style={{ fontSize: 14, marginTop: 16, marginBottom: 0 }}>
                On a computer? Drag cards with your mouse, use the buttons below, or the ← ↑ → keys.
              </p>
              <button className='btn btn--primary btn--block' style={{ marginTop: 26 }} onClick={finishTutorial}>
                Show my deck
              </button>
            </div>
          )}

          {!vaultPending && tutorialDone && cards.length === 0 && (
            <div className='deck-empty'>
              <div>
                <SparklesIcon size={26} color='var(--purple-primary)' style={{ margin: '0 auto 12px', display: 'block' }} />
                <h2 className='h2' style={{ marginBottom: 8 }}>
                  {loading && projectIds.length === 0 ? 'Finding opportunities…' : 'Deck cleared'}
                </h2>
                <p className='muted' style={{ fontSize: 14.5, lineHeight: 1.5, maxWidth: 240, margin: '0 auto 18px' }}>
                  {loading && projectIds.length === 0
                    ? 'One moment — fetching what’s live right now.'
                    : skippedCards.length > 0 || savedCards.length > 0
                    ? 'Every opportunity is in your hands now — or bring something back.'
                    : 'No opportunities are live right now. Check back soon.'}
                </p>
                {skippedCards.length > 0 && (
                  <button
                    className='btn btn--primary'
                    onClick={() => {
                      setSkipped(restoreAllSkipped());
                    }}
                  >
                    <RotateCcwIcon size={17} /> Reshuffle passed cards
                  </button>
                )}
                {savedCards.length > 0 && (
                  <div className='hstack' style={{ justifyContent: 'center', gap: 10, marginTop: 10 }}>
                    <button className='btn btn--ghost btn--sm' onClick={() => setSheet('saved')}>
                      Review saved
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {!vaultPending &&
            tutorialDone &&
            cards
              .slice(0, 3)
              .reverse()
              .map((c) => {
                const depth = cards.indexOf(c);
                return (
                  <DeckCard
                    key={c.id}
                    card={c}
                    top={depth === 0}
                    depth={depth}
                    seed={projectIds.indexOf(c.id)}
                    forceExit={forced && forced.id === c.id ? forced.dir : null}
                    onDecide={decide}
                    onOpen={() => setSheet('detail')}
                  />
                );
              })}
        </div>

        {!vaultPending && (
          <div className='deck__actions'>
            <button className='deck-action deck-action--skip' aria-label='Pass' onClick={() => buttonDecide('skip')}>
              <XIcon size={26} />
            </button>
            <button className='deck-action deck-action--apply' aria-label='Open and apply' onClick={() => buttonDecide('apply')}>
              <UserRoundPlusIcon size={28} />
            </button>
            <button className='deck-action deck-action--save' aria-label='Save for later' onClick={() => buttonDecide('save')}>
              <BookmarkIcon size={24} />
            </button>
          </div>
        )}

        {vaultFailed && !vaultAck && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 1500,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(30, 22, 38, 0.44)',
              backdropFilter: 'blur(4px)',
              padding: 20,
            }}
          >
            <div
              style={{
                backgroundColor: 'var(--surface)',
                borderRadius: 26,
                boxShadow: 'var(--shadow-card)',
                padding: '28px 24px',
                maxWidth: 340,
                width: '100%',
              }}
            >
              <h3 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 8px' }}>Your Vault didn’t load</h3>
              <p className='muted' style={{ fontSize: 14.5, lineHeight: 1.55, margin: '0 0 18px' }}>
                Your saved cards, chats and credentials live in your Vault. Log out and back in to try again, or
                continue without it — some things will be limited.
              </p>
              <button className='btn btn--primary btn--block' onClick={() => void logout()}>
                Log out &amp; try again
              </button>
              <button className='btn btn--ghost btn--block' style={{ marginTop: 10 }} onClick={continueWithoutVault}>
                Continue without Vault
              </button>
            </div>
          </div>
        )}

        {sheet === 'detail' && top && (
          <DetailSheet
            card={top}
            description={profiles[top.id]?.description}
            onClose={() => setSheet(null)}
            onOpen={() => {
              setSheet(null);
              window.setTimeout(() => buttonDecide('apply'), 120);
            }}
            onSave={() => {
              setSheet(null);
              window.setTimeout(() => buttonDecide('save'), 120);
            }}
          />
        )}

        {sheet === 'saved' && (
          <>
            <button className='sheet-scrim anim-fade' aria-label='Close' onClick={() => setSheet(null)} />
            <div className='sheet sheet--in'>
              <div className='sheet__grip' />
              <h3 style={{ fontSize: 22, marginBottom: 4 }}>Saved for later</h3>
              <p className='muted' style={{ fontSize: 14.5, marginBottom: 14, marginTop: 0 }}>
                Swipe up on any card to tuck it here.
              </p>

              {savedCards.length === 0 && (
                <div className='card--inset card center' style={{ padding: '28px 20px', marginBottom: 8 }}>
                  <BookmarkIcon size={22} color='var(--text-secondary)' style={{ margin: '0 auto 8px', display: 'block' }} />
                  <p className='muted' style={{ fontSize: 14, margin: 0 }}>
                    Nothing saved yet.
                  </p>
                </div>
              )}
              {savedCards.map((id) => (
                <SavedRow key={id} id={id} name={profiles[id]?.name} thumb={profiles[id]?.image || profiles[id]?.logo}>
                  <button
                    className='btn btn--primary btn--sm'
                    onClick={() => {
                      restore(id);
                      setSheet(null);
                    }}
                  >
                    To deck
                  </button>
                </SavedRow>
              ))}

              {skippedCards.length > 0 && (
                <>
                  <p className='muted' style={{ fontSize: 14, fontWeight: 700, margin: '16px 0 8px' }}>
                    PASSED
                  </p>
                  {skippedCards.map((id) => (
                    <SavedRow key={id} id={id} name={profiles[id]?.name} thumb={profiles[id]?.image || profiles[id]?.logo} dim>
                      <button className='iconbtn' aria-label={`Bring ${profiles[id]?.name ?? 'card'} back`} onClick={() => restore(id)}>
                        <RotateCcwIcon size={18} />
                      </button>
                    </SavedRow>
                  ))}
                </>
              )}
              <div style={{ height: 6 }} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SavedRow({
  id,
  name,
  thumb,
  dim,
  children,
}: {
  id: string;
  name?: string;
  thumb?: string;
  dim?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className='status-item' style={{ marginBottom: 10, opacity: dim ? 0.75 : 1 }}>
      {thumb ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={thumb} className='status-item__thumb' alt='' />
      ) : (
        <span className='status-item__thumb' style={{ background: 'var(--surface-2)' }} />
      )}
      <div className='status-item__body'>
        <div className='status-item__title'>{name || id}</div>
        <div className='status-item__meta'>Verified opportunity</div>
      </div>
      {children}
    </div>
  );
}

function DetailSheet({
  card,
  description,
  onClose,
  onOpen,
  onSave,
}: {
  card: DeckCardData;
  description?: string;
  onClose: () => void;
  onOpen: () => void;
  onSave: () => void;
}) {
  return (
    <>
      <button className='sheet-scrim anim-fade' aria-label='Close details' onClick={onClose} />
      <div className='sheet sheet--in' style={{ padding: 0, maxHeight: '92dvh' }}>
        <div style={{ position: 'relative' }}>
          {card.image && card.logoOnly ? (
            <div style={{ position: 'relative', width: '100%', height: 190, overflow: 'hidden', borderRadius: '26px 26px 0 0', background: 'var(--surface-2)' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={card.image}
                alt=''
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(24px) saturate(0.9)', transform: 'scale(1.25)', opacity: 0.55 }}
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={card.image}
                alt=''
                style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '44%', maxHeight: '62%', objectFit: 'contain' }}
              />
            </div>
          ) : card.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={card.image} alt='' style={{ width: '100%', height: 190, objectFit: 'cover', borderRadius: '26px 26px 0 0', display: 'block' }} />
          ) : (
            <div style={{ width: '100%', height: 120, background: 'var(--purple-tint)', borderRadius: '26px 26px 0 0' }} />
          )}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '26px 26px 0 0',
              background: 'linear-gradient(to top, var(--surface) 2%, transparent 55%)',
            }}
          />
          <button
            className='iconbtn'
            onClick={onClose}
            aria-label='Close details'
            style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(29, 23, 33, 0.7)', color: '#fff' }}
          >
            <XIcon size={20} />
          </button>
        </div>

        <div style={{ padding: '0 20px calc(20px + env(safe-area-inset-bottom))' }}>
          <span className='deck-card__provider' style={{ marginTop: 4, color: 'var(--text-primary)', opacity: 1 }}>
            <BadgeCheckIcon size={15} color='var(--green-primary)' /> {card.provider || 'Verified partner'}
          </span>
          <h2 className='title-lg' style={{ margin: '6px 0 4px' }}>
            {card.title}
          </h2>
          {(card.location || card.typeLabel) && (
            <p className='muted' style={{ fontSize: 14.5, margin: 0 }}>
              {[card.location, card.typeLabel].filter(Boolean).join(' · ')}
            </p>
          )}

          {description && (
            <p style={{ fontSize: 14.5, lineHeight: 1.6, marginTop: 14, whiteSpace: 'pre-line' }}>{description}</p>
          )}

          <div className='hstack' style={{ gap: 10, marginTop: 16 }}>
            <button className='btn btn--ghost' style={{ flex: 1 }} onClick={onSave}>
              <BookmarkIcon size={18} /> Save
            </button>
            <button className='btn btn--primary' style={{ flex: 2 }} onClick={onOpen}>
              <ArrowRightIcon size={18} /> Open opportunity
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
