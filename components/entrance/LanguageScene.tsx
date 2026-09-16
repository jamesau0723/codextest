'use client';

/**
 * Scene 1 — language choice (spec 3).
 * All three options carry equal default weight: nothing here sets a selected
 * state or a distinguishing style on any one of them.
 */
import { useEffect, useId, useRef } from 'react';
import { motion } from 'framer-motion';
import { LANGUAGE_CHOICES, copyFor, type Locale } from './lib/content';

export function LanguageScene({
  locale,
  onSelect
}: {
  locale: Locale;
  onSelect: (locale: Locale) => void;
}) {
  const copy = copyFor(locale);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const headingId = useId();

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, []);

  return (
    <motion.section
      className="d-scene"
      data-scene="language"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      <h2
        className="d-scene__heading"
        id={headingId}
        lang={copy.htmlLang}
        tabIndex={-1}
        ref={headingRef}
      >
        {copy.languageHeading}
      </h2>
      <div className="d-language" role="group" aria-labelledby={headingId}>
        {LANGUAGE_CHOICES.map((choice) => (
          <button
            key={choice.locale}
            type="button"
            className="d-button d-language__option"
            lang={choice.lang}
            data-locale={choice.locale}
            data-action="select-language"
            onClick={() => onSelect(choice.locale)}
          >
            {choice.label}
          </button>
        ))}
      </div>
    </motion.section>
  );
}
