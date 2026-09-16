'use client';

/**
 * DFestivalEntrance — scene state, focus, the hold gesture and completion.
 *
 * Viewport state is deliberately kept out of scene state, so a rotation or a
 * resize can never restart the video or the sequence.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { LanguageScene } from './LanguageScene';
import { QuestionScene } from './QuestionScene';
import { WordPassage, StaticWordList } from './WordPassage';
import { FinalD } from './FinalD';
import { HoldFeedback, useHintLifecycle } from './HoldFeedback';
import { useHoldToSkip } from './hooks/useHoldToSkip';
import { useEntranceViewport } from './hooks/useEntranceViewport';
import { useFocusTrap } from './hooks/useFocusTrap';
import { useWordFit } from './hooks/useWordFit';
import { SceneClock } from './lib/clock';
import { LONGEST_WORD, copyFor, TIMING, type Locale } from './lib/content';
import type { ViewportShape } from './lib/mediaConfig';
import { syncLocaleToUrl } from './lib/locale';
import { writeLocale, writeOutcome, type Outcome } from './lib/storage';

export type Scene = 'LANGUAGE' | 'QUESTION_1' | 'QUESTION_2' | 'WORDS' | 'FINAL_D';

export type DFestivalEntranceProps = {
  initialLocale: Locale;
  onLocaleChange?: (locale: Locale) => void;
  /**
   * `zoom` asks the gate to carry the footage down into the homepage hero
   * before the entrance is torn down; it resolves when that move is finished.
   */
  onExit: (outcome: Outcome, transition: 'fade' | 'zoom') => void;
  zoomToHome: () => Promise<void>;
  /**
   * The media layer is created and owned by the gate, not by the entrance, so
   * a still-playing video can outlive the entrance and be handed to the
   * homepage instead of being destroyed and recreated.
   */
  mediaLayer: HTMLElement | null;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  mediaState: string;
  onShapeChange: (shape: ViewportShape) => void;
};

export function DFestivalEntrance({
  initialLocale,
  onLocaleChange,
  onExit,
  zoomToHome,
  mediaLayer,
  videoRef,
  mediaState,
  onShapeChange
}: DFestivalEntranceProps) {
  const prefersReducedMotion = useReducedMotion();
  const reducedMotion = Boolean(prefersReducedMotion);

  const [locale, setLocale] = useState<Locale>(initialLocale);
  const [scene, setScene] = useState<Scene>('LANGUAGE');
  const [exiting, setExiting] = useState(false);
  const [zooming, setZooming] = useState(false);
  const [preview, setPreview] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);

  const rootRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const probeRef = useRef<HTMLSpanElement>(null);
  const clockRef = useRef(new SceneClock());
  const holdSnapshot = useRef<number | null>(null);
  const exitingRef = useRef(false);

  const geometry = useEntranceViewport(rootRef, (next) => {
    onShapeChange(next.shape);
    // A geometry change cancels an in-progress hold without navigating.
    hold.cancelForViewportChange();
  });

  // The gate's media layer is placed as the entrance's base layer. It is never
  // removed here: the gate decides whether the homepage adopts it on exit.
  useEffect(() => {
    if (mediaLayer && rootRef.current) rootRef.current.prepend(mediaLayer);
  }, [mediaLayer]);

  useFocusTrap(rootRef, !exiting);
  // Refit the shared word size whenever the viewport changes.
  useWordFit(rootRef, scrollerRef, probeRef, `${geometry.width}x${geometry.height}`);
  const hintState = useHintLifecycle(scene !== 'LANGUAGE');

  const goTo = useCallback((next: Scene) => {
    clockRef.current.reset(0);
    setScene(next);
  }, []);

  /** Single guard against double navigation and duplicate storage writes. */
  const commitExit = useCallback(
    (outcome: Outcome) => {
      if (exitingRef.current) return;
      exitingRef.current = true;
      setExiting(true);
      setPreview(false);
      writeOutcome(outcome);
      const duration = outcome === 'completed' ? TIMING.exitNormal : TIMING.exitSkip;
      setTimeout(() => onExit(outcome, 'fade'), duration);
    },
    [onExit]
  );

  /**
   * The sequence finishing enters the site by itself: the text and scrim clear,
   * and the footage keeps playing as it shrinks into the homepage hero. There
   * is nothing to press.
   */
  const enterByZoom = useCallback(() => {
    if (exitingRef.current) return;
    exitingRef.current = true;
    writeOutcome('completed');
    setPreview(false);
    setExiting(true);
    setZooming(true);
    // The gate owns the media layer, so it runs the move; the entrance only
    // clears itself out of the way.
    void zoomToHome().then(() => onExit('completed', 'zoom'));
  }, [zoomToHome, onExit]);

  const hold = useHoldToSkip(
    rootRef,
    {
      onStart: () => {
        // Suspend the scene clock and remember the exact time, so a cancel
        // restores it rather than losing it.
        holdSnapshot.current = clockRef.current.elapsed;
        clockRef.current.freeze('hold');
        videoRef.current?.pause();
      },
      onProgress: setHoldProgress,
      onArm: () => setPreview(true),
      onCommit: () => commitExit('skipped'),
      onCancel: () => {
        setPreview(false);
        setHoldProgress(0);
        if (holdSnapshot.current !== null) {
          clockRef.current.seek(holdSnapshot.current);
          holdSnapshot.current = null;
        }
        clockRef.current.thaw('hold');
        if (!exitingRef.current) void videoRef.current?.play().catch(() => {});
      }
    },
    !exiting
  );

  // Escape, unless a higher-priority dialog needs it first.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || exitingRef.current) return;
      if (document.querySelector('dialog[open], [data-priority-dialog="true"]')) return;
      event.preventDefault();
      commitExit('skipped');
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [commitExit]);

  // Hidden tab freezes playback and scene time; never fast-forward unseen words.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        clockRef.current.freeze('hidden');
        videoRef.current?.pause();
      } else {
        clockRef.current.thaw('hidden');
        if (!exitingRef.current) void videoRef.current?.play().catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  const selectLanguage = useCallback(
    (next: Locale) => {
      setLocale(next);
      writeLocale(next);
      syncLocaleToUrl(next);
      onLocaleChange?.(next);
      clockRef.current.reset(0);
      setScene('QUESTION_1');
    },
    [onLocaleChange]
  );

  const copy = copyFor(locale);

  return (
    <motion.div
      className="d-entrance"
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label={copy.entranceLabel}
      data-state={exiting ? 'EXITING' : scene}
      data-media={mediaState}
      data-shape={geometry.shape}
      data-preview={String(preview)}
      data-zooming={String(zooming)}
      data-reduced-motion={String(reducedMotion)}
      initial={{ opacity: 1 }}
      animate={{
        // A zoom exit keeps the root fully opaque: the footage has to stay
        // visible while it travels. Its background clears instead, so the
        // homepage shows around the shrinking frame.
        opacity: zooming ? 1 : exiting ? 0 : preview ? 0.18 : 1,
        backgroundColor: zooming ? 'rgba(0,0,0,0)' : 'rgba(0,0,0,1)'
      }}
      transition={{
        duration: zooming
          ? TIMING.zoomOut / 1000
          : exiting
            ? TIMING.exitSkip / 1000
            : TIMING.holdPreview / 1000,
        ease: zooming ? [0.65, 0, 0.35, 1] : 'easeInOut'
      }}
      style={{ pointerEvents: exiting ? 'none' : 'auto' }}
    >
      <motion.div
        className="d-entrance__scrim"
        animate={{ opacity: zooming ? 0 : 1 }}
        transition={{ duration: TIMING.zoomUiFade / 1000, ease: 'easeOut' }}
      />

      {/* Cinematic soft edge along the bottom of the footage. */}
      <motion.div
        className="d-entrance__filmedge"
        aria-hidden="true"
        animate={{ opacity: zooming ? 0 : 1 }}
        transition={{ duration: TIMING.zoomUiFade / 1000, ease: 'easeOut' }}
      />

      <motion.div
        className="d-entrance__ui"
        animate={{ opacity: zooming ? 0 : 1 }}
        transition={{ duration: TIMING.zoomUiFade / 1000, ease: 'easeOut' }}
      >
        <div className="d-entrance__content" ref={scrollerRef}>
          <AnimatePresence mode="wait" initial={false}>
            {scene === 'LANGUAGE' && (
              <LanguageScene key="language" locale={locale} onSelect={selectLanguage} />
            )}

            {(scene === 'QUESTION_1' || scene === 'QUESTION_2') && (
              <QuestionScene
                key={scene}
                index={scene === 'QUESTION_1' ? 1 : 2}
                locale={locale}
                scrollerRef={scrollerRef}
                reducedMotion={reducedMotion}
                onAdvance={() => goTo(scene === 'QUESTION_1' ? 'QUESTION_2' : 'WORDS')}
              />
            )}

            {scene === 'WORDS' &&
              (reducedMotion ? (
                <StaticWordList
                  key="words-static"
                  locale={locale}
                  onEnter={() => commitExit('completed')}
                />
              ) : (
                <WordPassage
                  key="words"
                  locale={locale}
                  clock={clockRef.current}
                  onFinished={() => goTo('FINAL_D')}
                />
              ))}

            {scene === 'FINAL_D' && (
              <FinalD
                key="final"
                locale={locale}
                clock={clockRef.current}
                reducedMotion={reducedMotion}
                onSettled={enterByZoom}
              />
            )}
          </AnimatePresence>

          {/* Measurement probe for the longest word. Never uses --word-scale. */}
          <span className="d-word__probe" aria-hidden="true" lang="en" ref={probeRef}>
            {LONGEST_WORD}
          </span>
        </div>

        <HoldFeedback
          locale={locale}
          hintState={hintState}
          progress={holdProgress}
          reducedMotion={reducedMotion}
        />
      </motion.div>
    </motion.div>
  );
}

/** Portal the entrance to the document body, outside every page container. */
export function EntrancePortal(props: DFestivalEntranceProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(<DFestivalEntrance {...props} />, document.body);
}
