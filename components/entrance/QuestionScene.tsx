'use client';

/**
 * Scenes 2 and 3 — a scroll-scrubbed question with an always-available advance
 * control (spec 3).
 *
 * Structure: a tall track supplies the scroll distance, and a sticky pin holds
 * the text at the exact centre of the viewport for the whole scrub, so the
 * spec's x=50% / y=50% centring requirement survives the scroll interaction.
 *
 *   .d-scene--scroll
 *     .d-scroll-track    one viewport + the scrub distance
 *       .d-scroll-pin    sticky, one viewport tall, content centred
 *
 * The complete question is exposed to assistive technology once; the per-word
 * layer is decorative.
 */
import { useEffect, useRef } from 'react';
import { motion, useMotionValueEvent, useScroll } from 'framer-motion';
import { ScrollRevealText } from './ScrollRevealText';
import { copyFor, type Locale } from './lib/content';

export type QuestionSceneProps = {
  index: 1 | 2;
  locale: Locale;
  scrollerRef: React.RefObject<HTMLElement | null>;
  reducedMotion: boolean;
  onAdvance: () => void;
};

export function QuestionScene({
  index,
  locale,
  scrollerRef,
  reducedMotion,
  onAdvance
}: QuestionSceneProps) {
  const copy = copyFor(locale);
  const text = index === 1 ? copy.question1 : copy.question2;
  const trackRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const cueRef = useRef<HTMLParagraphElement>(null);

  // progress 0 when the track's top meets the scrollport's top, 1 when its
  // bottom meets the scrollport's bottom — i.e. scrollTop / scrub distance.
  const { scrollYProgress } = useScroll({
    container: scrollerRef as React.RefObject<HTMLElement>,
    target: trackRef,
    offset: ['start start', 'end end']
  });

  // The scroll affordance fades for good once the scrub starts.
  useMotionValueEvent(scrollYProgress, 'change', (value) => {
    cueRef.current?.classList.toggle('is-gone', value > 0.02);
  });

  useEffect(() => {
    // Each scene starts its own scrub from the top of the scrollport.
    if (scrollerRef.current) scrollerRef.current.scrollTop = 0;
    // Focus the scene's accessible heading without scrolling: the background
    // must not move, and the scrub must not jump off the top.
    headingRef.current?.focus({ preventScroll: true });
  }, [index, scrollerRef]);

  const main = (
    <div className="d-scene__main">
      {!reducedMotion && (
        <p className="d-scroll-cue" lang={copy.htmlLang} aria-hidden="true" ref={cueRef}>
          {copy.scrollCue}
        </p>
      )}
      <h2 className="d-scene__question" lang={copy.htmlLang} tabIndex={-1} ref={headingRef}>
        <span className="sr-only">{text}</span>
        <ScrollRevealText
          text={text}
          locale={locale}
          progress={scrollYProgress}
          reducedMotion={reducedMotion}
        />
      </h2>
      <button
        type="button"
        className="d-button d-scene__advance"
        data-action="advance"
        lang={copy.htmlLang}
        onClick={onAdvance}
      >
        {copy.continue}
      </button>
    </div>
  );

  if (reducedMotion) {
    // No scrub track: the question is shown in full and no scrolling is asked
    // of the user.
    return (
      <motion.section
        className="d-scene"
        data-scene={`question${index}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0 }}
      >
        {main}
      </motion.section>
    );
  }

  return (
    <motion.section
      className="d-scene d-scene--scroll"
      data-scene={`question${index}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25, ease: 'easeInOut' }}
    >
      <div className="d-scroll-track" ref={trackRef}>
        <div className="d-scroll-pin">{main}</div>
      </div>
    </motion.section>
  );
}
