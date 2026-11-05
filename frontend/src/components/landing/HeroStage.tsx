import { Component, Suspense, lazy, useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { BOARD, BOARD_LABEL, CLAIM_INDEX, NEXT_INDEX } from './slotBoard.ts';

const SlotWall3D = lazy(() => import('./SlotWall3D.tsx'));

/** The same board as the 3D wall, drawn in HTML: first paint, phones, reduced motion, no WebGL. */
function StaticBoard() {
  return (
    <div className="slotboard" aria-hidden="true">
      {BOARD.map((slot, index) => {
        const state =
          slot.booked || index === CLAIM_INDEX ? 'booked' : index === NEXT_INDEX ? 'next' : 'open';
        return (
          <span key={slot.time} className={`slotboard__card slotboard__card--${state}`} style={{ '--i': index } as CSSProperties}>
            <span className="slotboard__time">{slot.time}</span>
            <span className="slotboard__label">
              {state === 'booked' ? 'Booked' : state === 'next' ? 'Next free' : 'Open'}
            </span>
          </span>
        );
      })}
      <span className="slotboard__rival">
        <span className="slotboard__time">{BOARD[CLAIM_INDEX].time}</span>
        <span className="slotboard__stamp">Taken</span>
      </span>
    </div>
  );
}

function canRun3D(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  if (!window.matchMedia('(min-width: 900px) and (pointer: fine)').matches) return false;
  const nav = navigator as Navigator & { connection?: { saveData?: boolean }; deviceMemory?: number };
  if (nav.connection?.saveData === true) return false;
  if ((nav.hardwareConcurrency ?? 8) < 4 || (nav.deviceMemory ?? 8) < 4) return false;
  try {
    const canvas = document.createElement('canvas');
    return canvas.getContext('webgl2') !== null || canvas.getContext('webgl') !== null;
  } catch {
    return false;
  }
}

class WebGLBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/**
 * The hero's signature: times are taken, a second claim is smashed away. The 3D wall is
 * loaded after first paint and only where it can run well; it stops rendering off-screen.
 */
export function HeroStage() {
  const ref = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<'static' | '3d'>('static');
  const [ready, setReady] = useState(false);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (!canRun3D()) return;
    let cancelled = false;
    const start = () => {
      void document.fonts
        .load('italic 800 100px "Barlow Condensed"')
        .catch(() => undefined)
        .then(() => {
          if (!cancelled) setMode('3d');
        });
    };
    const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 400));
    const handle = idle(start);
    return () => {
      cancelled = true;
      if (typeof handle === 'number' && window.cancelIdleCallback !== undefined) window.cancelIdleCallback(handle);
    };
  }, []);

  useEffect(() => {
    const node = ref.current;
    if (mode !== '3d' || node === null || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.05 });
    observer.observe(node);
    return () => observer.disconnect();
  }, [mode]);

  return (
    <div ref={ref} className={`slotwall${ready ? ' is-3d' : ''}`} role="img" aria-label={BOARD_LABEL}>
      <StaticBoard />
      {mode === '3d' && (
        <WebGLBoundary fallback={null}>
          <Suspense fallback={null}>
            <Mounted onReady={setReady}>
              <SlotWall3D active={visible} />
            </Mounted>
          </Suspense>
        </WebGLBoundary>
      )}
    </div>
  );
}

function Mounted({ onReady, children }: { onReady: (ready: boolean) => void; children: ReactNode }) {
  useEffect(() => {
    const id = window.setTimeout(() => onReady(true), 120);
    return () => window.clearTimeout(id);
  }, [onReady]);
  return <>{children}</>;
}
