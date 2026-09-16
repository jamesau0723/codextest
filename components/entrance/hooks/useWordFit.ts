'use client';

/**
 * Keep all ten D-words at one shared font size that fits the longest of them
 * (spec 4: "reduce the entire word set's size at that breakpoint; do not wrap
 * Discernment or resize each word independently").
 *
 * A hidden probe renders the longest word at the unscaled size; if it does not
 * fit the available width, `--word-scale` shrinks the whole set.
 *
 * Re-runs on viewport change and once webfonts settle — a display face that
 * swaps in after the first measurement would otherwise leave the set sized
 * against the fallback's metrics.
 */
import { useCallback, useEffect } from 'react';

export function useWordFit(
  rootRef: React.RefObject<HTMLElement | null>,
  contentRef: React.RefObject<HTMLElement | null>,
  probeRef: React.RefObject<HTMLElement | null>,
  dependency: unknown
) {
  const fit = useCallback(() => {
    const root = rootRef.current;
    const content = contentRef.current;
    const probe = probeRef.current;
    if (!root || !content || !probe) return;

    const style = getComputedStyle(content);
    const available =
      content.clientWidth -
      parseFloat(style.paddingLeft || '0') -
      parseFloat(style.paddingRight || '0');
    if (!(available > 0)) return;

    root.style.setProperty('--word-scale', '1');
    const measured = probe.getBoundingClientRect().width;
    root.style.setProperty(
      '--word-scale',
      measured > available ? (available / measured).toFixed(4) : '1'
    );
  }, [rootRef, contentRef, probeRef]);

  useEffect(() => {
    fit();
  }, [fit, dependency]);

  useEffect(() => {
    let cancelled = false;
    document.fonts?.ready
      .then(() => {
        if (!cancelled) fit();
      })
      .catch(() => {
        /* font loading is best-effort */
      });
    return () => {
      cancelled = true;
    };
  }, [fit]);
}
