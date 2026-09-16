'use client';

/**
 * useHoldToSkip (spec 6).
 *
 * One Pointer Events state machine for mouse, touch and pen — not duplicate
 * touch and mouse timers.
 *
 *  - press anywhere inside the entrance starts a hold; the scene clock suspends
 *  - 0–150ms shows nothing, so an ordinary tap still looks like a tap
 *  - 150–1499ms shows a progress ring (progress includes the initial 150ms)
 *  - >=1500ms arms the skip and begins a non-interactive homepage preview
 *  - release after the threshold commits; release before it cancels and lets
 *    the pressed control's ordinary activation happen
 *  - the threshold race is decided by elapsed time at release, not by whether a
 *    frame callback happened to have fired
 *  - a successful or movement-cancelled hold swallows its synthetic click, so
 *    the page beneath is never clicked under the user's finger
 */
import { useEffect, useRef } from 'react';
import { useAnimationFrame } from 'framer-motion';
import { TIMING } from '../lib/content';
import { monotonicNow } from '../lib/clock';

type Stage = 'idle' | 'pressed' | 'progressing' | 'armed';

export type HoldCallbacks = {
  onStart?: () => void;
  onProgress?: (ratio: number) => void;
  onArm?: () => void;
  onCommit?: () => void;
  onCancel?: (reason: string) => void;
};

export function useHoldToSkip(
  rootRef: React.RefObject<HTMLElement | null>,
  callbacks: HoldCallbacks,
  enabled = true
) {
  // Callbacks live in a ref so re-renders never re-bind the pointer listeners
  // mid-gesture, which would drop an in-flight hold.
  const handlers = useRef(callbacks);
  handlers.current = callbacks;

  const stage = useRef<Stage>('idle');
  const pointerId = useRef<number | null>(null);
  const start = useRef({ x: 0, y: 0, at: 0 });
  const suppressClick = useRef(false);

  const finish = () => {
    stage.current = 'idle';
    pointerId.current = null;
  };

  const cancel = (reason: string) => {
    if (stage.current === 'idle') return;
    finish();
    handlers.current.onCancel?.(reason);
  };

  // One frame loop drives the progress ring; the commit decision never depends
  // on it having fired.
  useAnimationFrame(() => {
    if (stage.current === 'idle') return;
    const elapsed = monotonicNow() - start.current.at;

    if (elapsed >= TIMING.holdThreshold) {
      if (stage.current !== 'armed') {
        stage.current = 'armed';
        handlers.current.onProgress?.(1);
        handlers.current.onArm?.();
      }
      return;
    }

    if (elapsed >= TIMING.holdIndicatorDelay) {
      stage.current = 'progressing';
      // Progress includes the initial 150ms, so the ring reflects real elapsed
      // time against the threshold rather than restarting at 150ms.
      handlers.current.onProgress?.(Math.min(1, elapsed / TIMING.holdThreshold));
    }
  });

  useEffect(() => {
    const root = rootRef.current;
    if (!root || !enabled) return;

    const onPointerDown = (event: PointerEvent) => {
      // Never intercept right mouse-button holds.
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      if (stage.current !== 'idle') {
        // A second pointer cancels; a new press is then required.
        cancel('second-pointer');
        return;
      }
      stage.current = 'pressed';
      pointerId.current = event.pointerId;
      start.current = { x: event.clientX, y: event.clientY, at: monotonicNow() };
      // Deliberately NOT capturing the pointer onto the root: capture retargets
      // events and breaks native button activation.
      handlers.current.onStart?.();
    };

    const onPointerMove = (event: PointerEvent) => {
      if (stage.current === 'idle' || event.pointerId !== pointerId.current) return;
      const dx = event.clientX - start.current.x;
      const dy = event.clientY - start.current.y;
      if (Math.hypot(dx, dy) > TIMING.holdTolerancePx) {
        // Past tolerance: swallow the click so the press cannot also activate
        // whatever is under the pointer, and require a fresh press.
        suppressClick.current = true;
        cancel('movement');
      }
    };

    const onPointerUp = (event: PointerEvent) => {
      if (stage.current === 'idle' || event.pointerId !== pointerId.current) return;
      // Decided by elapsed time at release: a dropped frame must not lose a
      // valid hold.
      const elapsed = monotonicNow() - start.current.at;
      if (elapsed >= TIMING.holdThreshold) {
        suppressClick.current = true;
        finish();
        handlers.current.onCommit?.();
        return;
      }
      // Released early: cancel, and let the pressed control's ordinary
      // activation proceed — the click is NOT swallowed here.
      cancel('released-early');
    };

    const onPointerCancel = (event: PointerEvent) => {
      if (event.pointerId === pointerId.current) cancel('pointercancel');
    };
    const onLostCapture = (event: PointerEvent) => {
      if (event.pointerId === pointerId.current) cancel('lostpointercapture');
    };
    const onContextMenu = () => cancel('contextmenu');
    const onBlur = () => cancel('blur');
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') cancel('hidden');
    };
    root.addEventListener('pointerdown', onPointerDown);
    root.addEventListener('pointermove', onPointerMove);
    root.addEventListener('pointerup', onPointerUp);
    root.addEventListener('pointercancel', onPointerCancel);
    root.addEventListener('lostpointercapture', onLostCapture);
    root.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      root.removeEventListener('pointerdown', onPointerDown);
      root.removeEventListener('pointermove', onPointerMove);
      root.removeEventListener('pointerup', onPointerUp);
      root.removeEventListener('pointercancel', onPointerCancel);
      root.removeEventListener('lostpointercapture', onLostCapture);
      root.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rootRef, enabled]);

  /**
   * The click swallower is registered separately and is NOT gated on `enabled`.
   * A committed hold sets `enabled` to false in the same tick, and the gesture's
   * own click arrives after that — if the listener came down with the rest, the
   * click would land on whatever sits under the pointer (for instance selecting
   * the language button the user was holding).
   */
  useEffect(() => {
    const onClickCapture = (event: MouseEvent) => {
      if (!suppressClick.current) return;
      suppressClick.current = false;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    };
    // Capture phase, so a swallowed click never reaches any handler.
    window.addEventListener('click', onClickCapture, true);
    return () => window.removeEventListener('click', onClickCapture, true);
  }, []);

  /** Viewport geometry changed mid-hold: cancel without navigating. */
  return {
    cancelForViewportChange: () => cancel('viewport')
  };
}
