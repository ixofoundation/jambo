import { PointerEvent, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { ExpandIcon } from './icons';
import styles from './SubclaimModal.module.scss';

const EDGE_PADDING = 10;
const CLICK_MOVE_THRESHOLD = 5;
const FALLBACK_SIZE = { w: 140, h: 44 };

type Point = { x: number; y: number };

function clampToViewport(x: number, y: number, width: number, height: number): Point {
  if (typeof window === 'undefined') return { x, y };
  const maxX = Math.max(EDGE_PADDING, window.innerWidth - width - EDGE_PADDING);
  const maxY = Math.max(EDGE_PADDING, window.innerHeight - height - EDGE_PADDING);
  return {
    x: Math.min(maxX, Math.max(EDGE_PADDING, x)),
    y: Math.min(maxY, Math.max(EDGE_PADDING, y)),
  };
}

function bottomRightPosition(width: number, height: number): Point {
  if (typeof window === 'undefined') return { x: EDGE_PADDING, y: EDGE_PADDING };
  return clampToViewport(
    window.innerWidth - width - EDGE_PADDING,
    window.innerHeight - height - EDGE_PADDING,
    width,
    height,
  );
}

type FloatingClaimButtonProps = {
  onExpand: () => void;
  label?: string;
};

export default function FloatingClaimButton({ onExpand, label = 'Base claim' }: FloatingClaimButtonProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const sizeRef = useRef(FALLBACK_SIZE);
  const [position, setPosition] = useState<Point>(() => bottomRightPosition(FALLBACK_SIZE.w, FALLBACK_SIZE.h));
  const [placed, setPlaced] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef({
    active: false,
    pointerId: 0,
    offsetX: 0,
    offsetY: 0,
    startX: 0,
    startY: 0,
    moved: false,
  });

  const measureAndClamp = (nextPos?: Point) => {
    const node = buttonRef.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    sizeRef.current = { w: rect.width, h: rect.height };
    setPosition((prev) => clampToViewport((nextPos ?? prev).x, (nextPos ?? prev).y, rect.width, rect.height));
  };

  useLayoutEffect(() => {
    const node = buttonRef.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    sizeRef.current = { w: rect.width, h: rect.height };
    setPosition(bottomRightPosition(rect.width, rect.height));
    setPlaced(true);
    // Only run once on mount — initial placement.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!placed) return;
    measureAndClamp();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [label, placed]);

  useEffect(() => {
    const handleResize = () => measureAndClamp();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handlePointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      active: true,
      pointerId: e.pointerId,
      offsetX: e.clientX - position.x,
      offsetY: e.clientY - position.y,
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
    };
    setIsDragging(true);
  };

  const handlePointerMove = (e: PointerEvent<HTMLButtonElement>) => {
    if (!dragRef.current.active || e.pointerId !== dragRef.current.pointerId) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    if (Math.abs(dx) > CLICK_MOVE_THRESHOLD || Math.abs(dy) > CLICK_MOVE_THRESHOLD) {
      dragRef.current.moved = true;
    }
    const { w, h } = sizeRef.current;
    setPosition(clampToViewport(e.clientX - dragRef.current.offsetX, e.clientY - dragRef.current.offsetY, w, h));
  };

  const endDrag = (e: PointerEvent<HTMLButtonElement>) => {
    if (!dragRef.current.active || e.pointerId !== dragRef.current.pointerId) return;
    const wasTap = !dragRef.current.moved;
    dragRef.current.active = false;
    setIsDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    if (wasTap) onExpand();
  };

  return (
    <button
      ref={buttonRef}
      type='button'
      aria-label={`Open base claim: ${label}`}
      className={`${styles.floatingButton}${isDragging ? ` ${styles.floatingButtonDragging}` : ''}`}
      style={{ left: position.x, top: position.y, visibility: placed ? 'visible' : 'hidden' }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <ExpandIcon />
      <span className={styles.floatingButtonLabel}>{label}</span>
    </button>
  );
}
