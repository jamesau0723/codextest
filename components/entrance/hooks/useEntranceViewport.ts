'use client';

/**
 * useEntranceViewport (spec 7.3, 7.8).
 *
 *  - dynamic-height fallback ONLY for browsers without 100dvh
 *  - reports the viewport shape so crop alignment can follow it
 *  - notifies on resize / rotation / browser-chrome change, coalesced to a frame
 *
 * It owns no scene state: viewport changes must never restart the video or the
 * sequence, so this only ever reports geometry.
 */
import { useEffect, useRef, useState } from 'react';
import { viewportShape, type ViewportShape } from '../lib/mediaConfig';

export type Geometry = {
  width: number;
  height: number;
  shape: ViewportShape;
};

export function supportsDvh(): boolean {
  return typeof CSS !== 'undefined' && typeof CSS.supports === 'function'
    ? CSS.supports('height', '100dvh')
    : false;
}

export function useEntranceViewport(
  rootRef: React.RefObject<HTMLElement | null>,
  onChange?: (geometry: Geometry) => void
): Geometry {
  // Measured lazily on first render, not in an effect: the media source is
  // chosen once from the shape, so a placeholder shape would permanently pick
  // the wrong source. Safe for SSR because the entrance only mounts client-side.
  const [geometry, setGeometry] = useState<Geometry>(() => {
    if (typeof window === 'undefined') return { width: 0, height: 0, shape: 'balanced' };
    const width = window.innerWidth || document.documentElement.clientWidth || 0;
    const height = window.innerHeight || document.documentElement.clientHeight || 0;
    return { width, height, shape: viewportShape(width, height) };
  });
  const notify = useRef(onChange);
  notify.current = onChange;

  useEffect(() => {
    // Populate the legacy height variable only where `dvh` is genuinely absent;
    // where it works we install no competing JavaScript height observer.
    const needsLegacyHeight = !supportsDvh();
    let frame = 0;

    const apply = () => {
      frame = 0;
      const root = rootRef.current;
      const width = window.innerWidth || document.documentElement.clientWidth || 0;
      const height = window.innerHeight || document.documentElement.clientHeight || 0;
      const shape = viewportShape(width, height);

      if (root && needsLegacyHeight) {
        const vv = window.visualViewport;
        const scale = vv?.scale ?? 1;
        // At normal zoom only: under pinch zoom visualViewport.height shrinks,
        // and shrinking the root to match would fight the user's zoom.
        const measured = scale > 1.01 ? height : Math.round(vv?.height ?? height);
        root.style.setProperty('--entrance-legacy-height', `${measured}px`);
      }

      setGeometry((previous) =>
        previous.width === width && previous.height === height && previous.shape === shape
          ? previous
          : { width, height, shape }
      );
      notify.current?.({ width, height, shape });
    };

    const schedule = () => {
      // Coalesced into the next frame — no debounce delay that would leave a
      // visible gap, and no polling.
      if (frame === 0) frame = requestAnimationFrame(apply);
    };

    apply();
    window.addEventListener('resize', schedule, { passive: true });
    window.addEventListener('orientationchange', schedule, { passive: true });
    window.visualViewport?.addEventListener('resize', schedule, { passive: true });
    window.visualViewport?.addEventListener('scroll', schedule, { passive: true });

    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('orientationchange', schedule);
      window.visualViewport?.removeEventListener('resize', schedule);
      window.visualViewport?.removeEventListener('scroll', schedule);
      rootRef.current?.style.removeProperty('--entrance-legacy-height');
    };
  }, [rootRef]);

  return geometry;
}
