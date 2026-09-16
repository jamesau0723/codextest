'use client';

/**
 * Scene 4A — the ten-word passage (spec 3).
 *
 * Words 1–9: 200ms reveal, 800ms hold, 200ms disappearance.
 * Dawn: 200ms reveal, 1,200ms hold, then the separate final transformation.
 *
 * Opacity and glow are written to motion values inside one animation frame
 * callback, so the passage never re-renders React 60 times a second — only the
 * ten word changes do.
 */
import { useRef, useState } from 'react';
import { motion, useAnimationFrame, useMotionValue } from 'framer-motion';
import {
  WORDS,
  TIMING,
  copyFor,
  wordTranslation,
  type Locale
} from './lib/content';
import type { SceneClock } from './lib/clock';

export function WordPassage({
  locale,
  clock,
  onFinished,
  onEnter
}: {
  locale: Locale;
  clock: SceneClock;
  onFinished: () => void;
  onEnter: () => void;
}) {
  const copy = copyFor(locale);
  const [index, setIndex] = useState(0);
  const opacity = useMotionValue(0);
  const textShadow = useMotionValue('none');
  const finished = useRef(false);
  const panelRef = useRef<HTMLElement>(null);

  useAnimationFrame(() => {
    if (finished.current) return;
    const elapsed = clock.elapsed;
    const last = WORDS[WORDS.length - 1];

    if (elapsed >= last.end) {
      finished.current = true;
      opacity.set(1);
      textShadow.set('none');
      onFinished();
      return;
    }

    const next = WORDS.findIndex((word) => elapsed >= word.start && elapsed < word.end);
    if (next === -1) return;
    if (next !== index) setIndex(next);

    const word = WORDS[next];
    const local = elapsed - word.start;
    const span = word.end - word.start;
    const isDawn = next === WORDS.length - 1;

    let value: number;
    let glow: number;
    if (local < TIMING.wordReveal) {
      const progress = local / TIMING.wordReveal;
      value = progress;
      // A very soft white glow that settles as the word becomes readable.
      glow = 1 - progress;
    } else if (!isDawn && local > span - TIMING.wordDisappear) {
      value = Math.max(0, (span - local) / TIMING.wordDisappear);
      glow = 0;
    } else {
      value = 1;
      glow = 0;
    }

    opacity.set(value);
    // The core lettering stays pure white; only the halo changes.
    textShadow.set(
      glow > 0
        ? `0 0 ${(glow * 30).toFixed(2)}px rgba(255,255,255,${(glow * 0.85).toFixed(3)})`
        : 'none'
    );
  });

  const word = WORDS[index];
  const translation = wordTranslation(word, locale);

  return (
    <motion.section
      className="d-scene"
      data-scene="words"
      ref={panelRef}
      tabIndex={-1}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25, ease: 'easeInOut' }}
    >
      <div className="d-scene__main">
        <motion.div className="d-word" aria-hidden="true" style={{ opacity }}>
          <motion.span className="d-word__en" lang="en" style={{ textShadow }}>
            {word.en}
          </motion.span>
          {translation && (
            <motion.span className="d-word__zh" lang={copy.htmlLang} style={{ textShadow }}>
              {translation}
            </motion.span>
          )}
        </motion.div>

        {/* One stable accessible list, announced once. No per-word live updates. */}
        <div className="sr-only" aria-live="polite">
          <p>{copy.wordListLabel}</p>
          <ol>
            {WORDS.map((entry) => {
              const zh = wordTranslation(entry, locale);
              return (
                <li key={entry.en}>
                  <span lang="en">{entry.en}</span>
                  {zh ? <> <span lang={copy.htmlLang}>{zh}</span></> : null}
                </li>
              );
            })}
          </ol>
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

/** Reduced-motion alternative: all ten words at once, scrollable, Enter ready. */
export function StaticWordList({
  locale,
  onEnter
}: {
  locale: Locale;
  onEnter: () => void;
}) {
  const copy = copyFor(locale);
  const headingRef = useRef<HTMLHeadingElement>(null);

  return (
    <section className="d-scene" data-scene="words">
      <div className="d-scene__main d-scene__main--static">
        <h2 className="sr-only" tabIndex={-1} ref={headingRef}>
          {copy.wordListLabel}
        </h2>
        <ul className="d-static-words">
          {WORDS.map((word) => {
            const zh = wordTranslation(word, locale);
            return (
              <li key={word.en}>
                <span className="d-static-words__en" lang="en">
                  {word.en}
                </span>
                {zh && (
                  <span className="d-static-words__zh" lang={copy.htmlLang}>
                    {zh}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
        <button
          type="button"
          className="d-button d-scene__advance d-scene__advance--static"
          data-action="enter"
          lang={copy.htmlLang}
          onClick={onEnter}
        >
          {copy.enter}
        </button>
      </div>
    </section>
  );
}
