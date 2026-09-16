'use client';

/**
 * Restrict keyboard focus to the entrance and keep the page beneath inert
 * (spec 8). Restores scroll and inertness on teardown.
 */
import { useEffect } from 'react';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function useFocusTrap(
  rootRef: React.RefObject<HTMLElement | null>,
  active: boolean,
  siteRootId = 'site-root'
) {
  useEffect(() => {
    if (!active) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const siteRoot = document.getElementById(siteRootId);
    siteRoot?.setAttribute('inert', '');
    siteRoot?.setAttribute('aria-hidden', 'true');

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const root = rootRef.current;
      if (!root) return;
      const focusable = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (node) => node.offsetParent !== null || node === document.activeElement
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active_ = document.activeElement;

      if (event.shiftKey && (active_ === first || !root.contains(active_))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active_ === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.body.style.overflow = previousOverflow;
      siteRoot?.removeAttribute('inert');
      siteRoot?.removeAttribute('aria-hidden');
    };
  }, [rootRef, active, siteRootId]);
}
