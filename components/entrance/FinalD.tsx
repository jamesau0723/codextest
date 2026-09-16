'use client';

/**
 * Scene 4B — Dawn becomes D, then D FESTIVAL (spec 3).
 *
 * `awn` dissolves over 350ms while the surviving D slides to true centre, then
 * D FESTIVAL is revealed underneath over the following 250ms. A plain white
 * typographic transformation: no particles, no 3D logo animation.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { motion, useAnimationFrame, useMotionValue } from 'framer-motion';
import { WORDS, TIMING, copyFor, wordTranslation, type Locale } from './lib/content';
import type { SceneClock } from './lib/clock';

export function FinalD({
  locale,
  clock,
  reducedMotion,
  onEnter
}: {
  locale: Locale;
  clock: SceneClock;
  reducedMotion: boolean;
  onEnter: () => void;
}) {
  const copy = copyFor(locale);
  const translation = wordTranslation(WORDS[WORDS.length - 1], locale);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const awnRef = useRef<HTMLSpanElement>(null);
  const [awnWidth, setAwnWidth] = useState(0);

  const awnOpacity = useMotionValue(reducedMotion ? 0 : 1);
  const awnMargin = useMotionValue(0);
  const zhOpacity = useMotionValue(reducedMotion ? 0 : 1);
  const festivalOpacity = useMotionValue(reducedMotion ? 1 : 0);

  // Measure `awn` before paint so the surviving D can slide to true centre by
  // exactly its own width.
  useLayoutEffect(() => {
    const width = awnRef.current?.getBoundingClientRect().width ?? 0;
    setAwnWidth(width);
    if (reducedMotion) awnMargin.set(-width);
  }, [reducedMotion, awnMargin]);

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, []);

  useAnimationFrame(() => {
    if (reducedMotion || awnWidth === 0) return;
    const elapsed = clock.elapsed;
    const dissolve = Math.min(1, elapsed / TIMING.finalDissolve);
    const reveal = Math.min(
      1,
      Math.max(0, (elapsed - TIMING.finalDissolve) / TIMING.finalReveal)
    );
    awnOpacity.set(1 - dissolve);
    awnMargin.set(-awnWidth * dissolve);
    zhOpacity.set(1 - dissolve);
    festivalOpacity.set(reveal);
  });

  return (
    <motion.section
      className="d-scene"
      data-scene="final"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25, ease: 'easeInOut' }}
    >
      <div className="d-scene__main">
        <div className="d-final">
          <h2 className="d-final__word" lang="en" tabIndex={-1} ref={headingRef}>
            <span className="d-final__d">D</span>
            <motion.span
              className="d-final__awn"
              ref={awnRef}
              style={{ opacity: awnOpacity, marginRight: awnMargin }}
            >
              awn
            </motion.span>
          </h2>
          {translation && (
            <motion.span className="d-final__zh" lang={copy.htmlLang} style={{ opacity: zhOpacity }}>
              {translation}
            </motion.span>
          )}
          <motion.p className="d-final__festival" lang="en" style={{ opacity: festivalOpacity }}>
            {copy.festival}
          </motion.p>
        </div>
        <button
          type="button"
          className="d-button d-scene__advance"
          data-action="enter"
          lang={copy.htmlLang}
          onClick={onEnter}
        >
          {copy.enter}
        </button>
      </div>
    </motion.section>
  );
}
