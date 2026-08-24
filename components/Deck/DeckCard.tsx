import { FC, useEffect, useRef, useState } from 'react';

import { BadgeCheckIcon, MapPinIcon } from '@components/Icons/icons';

export type SwipeDir = 'apply' | 'skip' | 'save';

export interface DeckCardData {
  id: string;
  title: string;
  provider?: string;
  image?: string;
  typeLabel?: string;
  location?: string;
}

const EXIT: Record<SwipeDir, { x: number; y: number; rotate: number }> = {
  apply: { x: 560, y: -40, rotate: 14 },
  skip: { x: -560, y: -40, rotate: -14 },
  save: { x: 0, y: -720, rotate: 0 },
};

const FALLBACK_GRADIENTS = [
  'linear-gradient(135deg,#84a98c,#2f6b52)',
  'linear-gradient(135deg,#f6c177,#e07a5f)',
  'linear-gradient(135deg,#8ecae6,#219ebc)',
  'linear-gradient(135deg,#cdb4db,#8e5ea2)',
];

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

interface Props {
  card: DeckCardData;
  top: boolean;
  depth: number; // 0 = top, 1 = next, 2 = after
  seed?: number;
  forceExit?: SwipeDir | null; // set by the action buttons under the deck
  onDecide: (dir: SwipeDir) => void;
  onOpen: () => void;
}

/**
 * One draggable opportunity card. Physics live here (pointer events + CSS
 * transforms — no animation library, low-end Android is the bar); the deck
 * decides outcomes.
 */
export const DeckCard: FC<Props> = ({ card, top, depth, seed = 0, forceExit, onDecide, onOpen }) => {
  const el = useRef<HTMLDivElement>(null);
  const applyStamp = useRef<HTMLDivElement>(null);
  const skipStamp = useRef<HTMLDivElement>(null);
  const saveStamp = useRef<HTMLDivElement>(null);
  const [imgFailed, setImgFailed] = useState(false);

  const state = useRef({
    dragging: false,
    moved: false,
    startX: 0,
    startY: 0,
    dx: 0,
    dy: 0,
    vx: 0,
    lastX: 0,
    lastT: 0,
    exited: false,
  });

  const setTransform = (dx: number, dy: number, animate: boolean) => {
    const node = el.current;
    if (!node) return;
    node.style.transition = animate ? 'transform 0.35s cubic-bezier(0.16, 1, 0.3, 1)' : 'none';
    node.style.transform = `translate(${dx}px, ${dy}px) rotate(${dx * 0.055}deg)`;
  };

  const setStamps = (dx: number, dy: number) => {
    if (applyStamp.current) applyStamp.current.style.opacity = String(clamp01((dx - 30) / 90));
    if (skipStamp.current) skipStamp.current.style.opacity = String(clamp01((-dx - 30) / 90));
    if (saveStamp.current) saveStamp.current.style.opacity = String(clamp01((-dy - 40) / 90));
  };

  const flyOut = (dir: SwipeDir) => {
    const s = state.current;
    if (s.exited) return;
    s.exited = true;
    const node = el.current;
    if (node) {
      const to = EXIT[dir];
      node.style.transition = 'transform 0.32s cubic-bezier(0.32, 0, 0.67, 0)';
      node.style.transform = `translate(${to.x}px, ${to.y}px) rotate(${to.rotate}deg)`;
    }
    if (dir === 'apply' && applyStamp.current) applyStamp.current.style.opacity = '1';
    if (dir === 'skip' && skipStamp.current) skipStamp.current.style.opacity = '1';
    if (dir === 'save' && saveStamp.current) saveStamp.current.style.opacity = '1';
    window.setTimeout(() => onDecide(dir), 240);
  };

  // Action buttons under the deck drive the same physics as a swipe.
  useEffect(() => {
    if (top && forceExit) flyOut(forceExit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forceExit, top]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (!top || state.current.exited) return;
    const s = state.current;
    s.dragging = true;
    s.moved = false;
    s.startX = e.clientX;
    s.startY = e.clientY;
    s.lastX = e.clientX;
    s.lastT = e.timeStamp;
    s.vx = 0;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const s = state.current;
    if (!s.dragging || s.exited) return;
    s.dx = e.clientX - s.startX;
    s.dy = e.clientY - s.startY;
    if (Math.abs(s.dx) > 6 || Math.abs(s.dy) > 6) s.moved = true;
    const dt = e.timeStamp - s.lastT;
    if (dt > 0) {
      s.vx = (e.clientX - s.lastX) / dt; // px per ms
      s.lastX = e.clientX;
      s.lastT = e.timeStamp;
    }
    setTransform(s.dx, s.dy, false);
    setStamps(s.dx, s.dy);
  };

  const onPointerUp = () => {
    const s = state.current;
    if (!s.dragging || s.exited) return;
    s.dragging = false;
    if (s.dy < -110 && Math.abs(s.dx) < 90) return flyOut('save');
    if (s.dx > 110 || s.vx > 0.65) return flyOut('apply');
    if (s.dx < -110 || s.vx < -0.65) return flyOut('skip');
    // Snap back
    setTransform(0, 0, true);
    setStamps(0, 0);
    s.dx = 0;
    s.dy = 0;
  };

  const onClick = () => {
    // A drag that ends on the card must not read as a tap.
    if (top && !state.current.moved && !state.current.exited) onOpen();
    state.current.moved = false;
  };

  const stackStyle: React.CSSProperties = top
    ? { zIndex: 3 }
    : {
        zIndex: 3 - depth,
        transform: `scale(${1 - depth * 0.045}) translateY(${depth * 14}px)`,
        opacity: depth > 1 ? 0.55 : 1,
        transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease',
      };

  return (
    <div
      ref={el}
      className='deck-card'
      style={{ ...stackStyle, background: FALLBACK_GRADIENTS[seed % FALLBACK_GRADIENTS.length] }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onClick={onClick}
      role={top ? 'button' : undefined}
      aria-label={top ? `${card.title} — tap for details` : undefined}
    >
      {card.image && !imgFailed && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={card.image} alt='' className='deck-card__img' draggable={false} onError={() => setImgFailed(true)} />
      )}
      <div className='deck-card__scrim' />

      {card.typeLabel && (
        <div className='deck-card__top'>
          <span className='meta-pill'>{card.typeLabel}</span>
        </div>
      )}

      {top && (
        <>
          <div ref={applyStamp} className='deck-card__stamp deck-card__stamp--apply'>
            APPLY
          </div>
          <div ref={skipStamp} className='deck-card__stamp deck-card__stamp--skip'>
            PASS
          </div>
          <div ref={saveStamp} className='deck-card__stamp deck-card__stamp--save'>
            SAVED
          </div>
        </>
      )}

      <div className='deck-card__body'>
        <span className='deck-card__provider'>
          <BadgeCheckIcon size={15} color='#7fd7b2' /> {card.provider || 'Verified partner'}
        </span>
        <h2 className='deck-card__title'>{card.title}</h2>
        <div className='deck-card__meta'>
          {card.location && (
            <span className='meta-pill'>
              <MapPinIcon size={13} /> {card.location}
            </span>
          )}
          <span className='meta-pill'>Tap for details</span>
        </div>
      </div>
    </div>
  );
};

export default DeckCard;
