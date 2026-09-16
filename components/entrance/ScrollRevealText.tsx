'use client';

/**
 * Scroll-Scrub Text Reveal.
 *
 * Words reveal one by one, tied directly to vertical scroll progress:
 *   unrevealed  opacity 0.2, filter blur(4px)
 *   revealed    opacity 1,   filter none
 *
 * Driven purely by scroll position through Framer Motion's `useTransform` — no
 * timers, no intervals, no time-based easing. Scrolling back up reverses it.
 */
import { memo } from 'react';
import { motion, useTransform, type MotionValue } from 'framer-motion';
import { TIMING } from './lib/content';
import { revealTokens, countWords } from './lib/segment';
import { clamp } from './lib/clock';

type RevealWordProps = {
  text: string;
  progress: MotionValue<number>;
  start: number;
  span: number;
};

/**
 * One word. A child component rather than inline transforms, because hooks
 * cannot be called in a loop whose length changes with the locale.
 */
const RevealWord = memo(function RevealWord({ text, progress, start, span }: RevealWordProps) {
  // Both properties are derived from the same explicit callback rather than a
  // range-based useTransform. The range form gave word 0 (input range starting
  // at exactly 0) a value inconsistent with the filter computed from the same
  // progress; one shared clamp keeps opacity and blur provably in step.
  const opacity = useTransform(progress, (value) => {
    const t = clamp((value - start) / span, 0, 1);
    return TIMING.revealOpacityFrom + (1 - TIMING.revealOpacityFrom) * t;
  });

  const filter = useTransform(progress, (value) => {
    const t = clamp((value - start) / span, 0, 1);
    const blur = TIMING.revealBlurFrom * (1 - t);
    // Drop the filter entirely once a word is readable: a blur filter across a
    // dozen inline boxes is real compositing work on a phone.
    return blur < 0.05 ? 'none' : `blur(${blur.toFixed(2)}px)`;
  });

  return (
    <motion.span className="d-reveal__w" style={{ opacity, filter }}>
      {text}
    </motion.span>
  );
});

export type ScrollRevealTextProps = {
  text: string;
  locale: string;
  progress: MotionValue<number>;
  /** Reduced motion shows the text in full and asks for no scrolling. */
  reducedMotion?: boolean;
};

export function ScrollRevealText({
  text,
  locale,
  progress,
  reducedMotion = false
}: ScrollRevealTextProps) {
  const tokens = revealTokens(text, locale);
  const total = countWords(tokens);
  // Each word travels over `scrubWindow` of total progress; the remainder is
  // spread across the words as staggered start points, so the cascade overlaps
  // rather than stepping one word at a time.
  const span = TIMING.scrubWindow;
  const spread = 1 - span;

  let wordIndex = -1;

  return (
    <span className="d-reveal" aria-hidden="true">
      {tokens.map((token, index) => {
        if (token.kind === 'space') {
          // Whitespace stays plain text so wrapping behaves exactly as it would
          // in an ordinary paragraph.
          return <span key={index}>{token.text}</span>;
        }
        wordIndex += 1;
        if (reducedMotion) {
          return (
            <span className="d-reveal__w d-reveal__w--static" key={index}>
              {token.text}
            </span>
          );
        }
        const start = total > 1 ? (wordIndex / (total - 1)) * spread : 0;
        return (
          <RevealWord
            key={index}
            text={token.text}
            progress={progress}
            start={start}
            span={span}
          />
        );
      })}
    </span>
  );
}
