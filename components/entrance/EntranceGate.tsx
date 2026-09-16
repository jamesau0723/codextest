'use client';

/**
 * Eligibility and routing (spec 9).
 *
 * Shows automatically only on an eligible homepage first visit with no saved
 * outcome. Deep links always open their target untouched.
 *
 * Nothing renders on the server: the decision depends on browser storage, so
 * rendering it during SSR would guarantee a hydration mismatch.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useReducedMotion } from 'framer-motion';
import { EntrancePortal } from './DFestivalEntrance';
import { PerformanceBackground, type MediaState } from './PerformanceBackground';
import { resolveProvisionalLocale } from './lib/locale';
import { readLocale, readOutcome, type Outcome } from './lib/storage';
import { DEFAULT_LOCALE, TIMING, type Locale } from './lib/content';
import {
  mediaFromOverride,
  viewportShape,
  type MediaConfig,
  type ViewportShape
} from './lib/mediaConfig';

export type EntranceGateProps = {
  /** Only an eligible homepage auto-shows the entrance. */
  eligible?: boolean;
  media?: Partial<MediaConfig> | null;
  onLocaleChange?: (locale: Locale) => void;
};

/**
 * Test seam: run the entrance against fixture media without editing the
 * production media configuration. Read client-side so the page can still be
 * server-rendered.
 */
function mediaFromSearch(): Partial<MediaConfig> | null {
  try {
    const raw = new URLSearchParams(window.location.search).get('media');
    return raw ? (JSON.parse(raw) as Partial<MediaConfig>) : null;
  } catch {
    return null;
  }
}

export function EntranceGate({ eligible = false, media, onLocaleChange }: EntranceGateProps) {
  // Reduced motion is read here, not only in the entrance, because it decides
  // whether any video is fetched at all.
  const reducedMotion = Boolean(useReducedMotion());
  const [open, setOpen] = useState(false);
  const [locale, setLocale] = useState<Locale>(DEFAULT_LOCALE);
  const [resolved, setResolved] = useState(false);
  const [replayTrigger, setReplayTrigger] = useState<HTMLElement | null>(null);
  const [seamMedia, setSeamMedia] = useState<Partial<MediaConfig> | null>(null);
  const [handedOver, setHandedOver] = useState(false);
  const [mediaState, setMediaState] = useState<MediaState>('none');
  const videoRef = useRef<HTMLVideoElement>(null);

  // Known synchronously: the media source is chosen once from the shape, so a
  // placeholder would permanently pick the wrong one.
  const [shape, setShape] = useState<ViewportShape>(() =>
    typeof window === 'undefined'
      ? 'balanced'
      : viewportShape(window.innerWidth, window.innerHeight)
  );
  // Captured once, alongside the shape: both feed the single source choice.
  const [viewportWidth] = useState(() =>
    typeof window === 'undefined' ? Number.POSITIVE_INFINITY : window.innerWidth
  );

  /**
   * The media layer is a plain DOM node owned by this component, not by the
   * entrance. The entrance places it as its base layer while it is open; on a
   * normal entry the homepage adopts the same node, so the video element is
   * never destroyed and playback continues instead of restarting.
   */
  const [mediaLayer] = useState<HTMLDivElement | null>(() => {
    if (typeof document === 'undefined') return null;
    const layer = document.createElement('div');
    layer.className = 'd-media-layer';
    return layer;
  });

  const resolvedMedia = useMemo(
    () => mediaFromOverride(media ?? seamMedia),
    [media, seamMedia]
  );

  useEffect(() => {
    const provisional = resolveProvisionalLocale({ saved: readLocale() }).locale;
    setLocale(provisional);
    onLocaleChange?.(provisional);

    setSeamMedia(mediaFromSearch());

    const outcome = readOutcome();
    const forced = new URLSearchParams(window.location.search).get('entrance') === 'replay';
    const shouldShow = forced || (eligible && outcome === null);

    document.documentElement.dataset.entrance = shouldShow ? 'open' : (outcome ?? 'bypassed');
    setOpen(shouldShow);
    setResolved(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eligible]);

  // The footer Replay control. Replay uses the saved language as provisional
  // and does not change the saved outcome until a new exit is committed.
  useEffect(() => {
    if (!resolved) return;
    const triggers = Array.from(
      document.querySelectorAll<HTMLElement>('[data-action="replay-entrance"]')
    );
    const onClick = (event: Event) => {
      setLocale(resolveProvisionalLocale({ saved: readLocale() }).locale);
      setReplayTrigger(event.currentTarget as HTMLElement);
      setOpen(true);
    };
    for (const trigger of triggers) {
      trigger.hidden = false;
      trigger.addEventListener('click', onClick);
    }
    return () => {
      for (const trigger of triggers) trigger.removeEventListener('click', onClick);
    };
  }, [resolved]);

  const heroHost = () =>
    document.querySelector<HTMLElement>('[data-reuses-entrance-video]');

  /**
   * Carry the footage from full viewport down into the homepage hero.
   *
   * The layout box is animated rather than a transform: `object-fit: cover`
   * then re-solves on every frame, so the footage is never scaled unevenly on
   * the way down. A transform would be cheaper and would squash it.
   *
   * Resolves either way — a missing hero, an unplayable video or reduced
   * motion all fall back to the ordinary fade, and never strand the entrance.
   */
  const zoomToHome = useCallback(async () => {
    const host = heroHost();
    const layer = mediaLayer;
    const video = videoRef.current;
    if (!host || !layer || reducedMotion || !video || video.readyState < 2) return;

    // The entrance locked body scroll; releasing it first lets the hero be
    // brought into view, which matters when the page is taller than the fold.
    document.body.style.overflow = '';
    host.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior });
    await new Promise((resolve) => requestAnimationFrame(resolve));

    const from = layer.getBoundingClientRect();
    const to = host.getBoundingClientRect();
    if (to.width < 1 || to.height < 1) return;

    Object.assign(layer.style, {
      position: 'fixed',
      top: `${from.top}px`,
      left: `${from.left}px`,
      width: `${from.width}px`,
      height: `${from.height}px`,
      zIndex: '1001',
      borderRadius: '0px'
    });

    const animation = layer.animate(
      [
        { top: `${from.top}px`, left: `${from.left}px`,
          width: `${from.width}px`, height: `${from.height}px` },
        { top: `${to.top}px`, left: `${to.left}px`,
          width: `${to.width}px`, height: `${to.height}px` }
      ],
      { duration: TIMING.zoomOut, easing: 'cubic-bezier(0.65, 0, 0.35, 1)', fill: 'forwards' }
    );

    await animation.finished.catch(() => {
      /* an interrupted animation still lands in the hero below */
    });
  }, [mediaLayer, reducedMotion, videoRef]);

  const handleExit = useCallback(
    (outcome: Outcome, transition: 'fade' | 'zoom' = 'fade') => {
      // Hand the still-playing element to a homepage that reuses it, rather
      // than destroying and recreating it.
      const host = heroHost();
      const video = videoRef.current;
      if (mediaLayer && host && video && !video.paused && video.readyState >= 2) {
        // Clear the inline geometry the zoom left behind; the hero's own box
        // takes over from here.
        mediaLayer.removeAttribute('style');
        mediaLayer.className = 'd-media-layer d-media-layer--hero';
        host.appendChild(mediaLayer);
        setHandedOver(true);
      } else {
        mediaLayer?.remove();
        setHandedOver(false);
      }

      void transition;
      setOpen(false);
      document.documentElement.dataset.entrance = outcome;
      if (replayTrigger && document.contains(replayTrigger)) {
        // A replay returns focus to its launching control.
        replayTrigger.focus();
        setReplayTrigger(null);
      } else {
        // Normal entry moves focus into the homepage main content.
        const main = document.getElementById('main-content');
        if (main) {
          main.tabIndex = -1;
          main.focus({ preventScroll: true });
        }
      }
    },
    [replayTrigger, mediaLayer, videoRef]
  );

  // Rendered into the persistent layer, so it survives the entrance closing.
  const background =
    mediaLayer && (open || handedOver)
      ? createPortal(
          <PerformanceBackground
            media={resolvedMedia}
            shape={shape}
            viewportWidth={viewportWidth}
            reducedMotion={reducedMotion}
            paused={false}
            videoRef={videoRef}
            onStateChange={setMediaState}
          />,
          mediaLayer
        )
      : null;

  return (
    <>
      {background}
      {open && (
        <EntrancePortal
          initialLocale={locale}
          mediaLayer={mediaLayer}
          videoRef={videoRef}
          zoomToHome={zoomToHome}
          mediaState={mediaState}
          onShapeChange={setShape}
          onLocaleChange={(next) => {
            setLocale(next);
            onLocaleChange?.(next);
          }}
          onExit={handleExit}
        />
      )}
    </>
  );
}
