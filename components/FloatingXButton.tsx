'use client';

import { useEffect, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react';

const X_PROFILE_URL = 'https://x.com/qianggu92086166';
const BUTTON_SIZE = 56;
const EDGE_MARGIN = 16;

type Position = {
  top: number;
  left: number;
};

const clamp = (value: number, min: number, max: number) => {
  if (Number.isNaN(value)) return min;
  return Math.min(Math.max(value, min), max);
};

export default function FloatingXButton() {
  const [position, setPosition] = useState<Position>(() => ({
    top: EDGE_MARGIN,
    left: EDGE_MARGIN
  }));
  const dragOffset = useRef({ x: 0, y: 0 });
  const dragging = useRef(false);
  const moved = useRef(false);
  const anchorRef = useRef<HTMLAnchorElement | null>(null);

  useEffect(() => {
    const initializePosition = () => {
      if (typeof window === 'undefined') return;
      setPosition({
        left: Math.max(EDGE_MARGIN, window.innerWidth - BUTTON_SIZE - EDGE_MARGIN),
        top: Math.max(EDGE_MARGIN, window.innerHeight - BUTTON_SIZE - EDGE_MARGIN)
      });
    };

    initializePosition();
  }, []);

  useEffect(() => {
    const handleResize = () => {
      if (typeof window === 'undefined') return;
      setPosition((current) => ({
        left: clamp(current.left, EDGE_MARGIN, Math.max(EDGE_MARGIN, window.innerWidth - BUTTON_SIZE - EDGE_MARGIN)),
        top: clamp(current.top, EDGE_MARGIN, Math.max(EDGE_MARGIN, window.innerHeight - BUTTON_SIZE - EDGE_MARGIN))
      }));
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handlePointerDown = (event: ReactPointerEvent<HTMLAnchorElement>) => {
    dragging.current = true;
    moved.current = false;
    dragOffset.current = {
      x: event.clientX - position.left,
      y: event.clientY - position.top
    };
    anchorRef.current?.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLAnchorElement>) => {
    if (!dragging.current) return;

    const { innerWidth, innerHeight } = window;
    const nextLeft = clamp(event.clientX - dragOffset.current.x, EDGE_MARGIN, innerWidth - BUTTON_SIZE - EDGE_MARGIN);
    const nextTop = clamp(event.clientY - dragOffset.current.y, EDGE_MARGIN, innerHeight - BUTTON_SIZE - EDGE_MARGIN);
    setPosition({ left: nextLeft, top: nextTop });
    moved.current = true;
  };

  const stopDragging = (event: ReactPointerEvent<HTMLAnchorElement>) => {
    dragging.current = false;
    if (anchorRef.current?.hasPointerCapture?.(event.pointerId)) {
      anchorRef.current.releasePointerCapture(event.pointerId);
    }
  };

  const handleClick = (event: ReactMouseEvent<HTMLAnchorElement>) => {
    if (moved.current) {
      event.preventDefault();
      moved.current = false;
    }
  };

  return (
    <a
      ref={anchorRef}
      href={X_PROFILE_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="访问 X (Twitter) 主页"
      className="floating-social-link"
      style={{ top: position.top, left: position.left }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={stopDragging}
      onPointerCancel={stopDragging}
      onClick={handleClick}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 1200 1227"
        xmlns="http://www.w3.org/2000/svg"
        className="floating-social-icon"
      >
        <path
          fill="currentColor"
          d="M714.2 519.4 1160.9 0H1036L666.3 428.4 373.8 0H0l468.4 684.2L0 1226.9h124.9l391.6-455.1 307.5 455.1H1200L714.2 519.4Zm-138.6 161.2-45.3-64.5L170.1 96.1h135l290.8 413 45.3 64.5 378.8 537.7H990.1L575.6 680.6Z"
        />
      </svg>
    </a>
  );
}

