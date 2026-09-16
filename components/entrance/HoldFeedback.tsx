'use client';

/**
 * Hold-progress feedback and the transient hold hint.
 *
 * Deviations from spec v2.0 section 5, at the client's request: the persistent
 * Skip control and the pause/resume control are gone, and the hint is no longer
 * persistent — it appears once the language has been chosen, holds for 2s, then
 * fades away for good.
 */
import { useEffect, useState } from 'react';
import { copyFor, TIMING, type Locale } from './lib/content';

const RING_RADIUS = 13;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export type HintState = 'idle' | 'visible' | 'leaving' | 'gone';

export function useHintLifecycle(reveal: boolean): HintState {
  const [state, setState] = useState<HintState>('idle');

  useEffect(() => {
    if (!reveal || state !== 'idle') return;
    setState('visible');
    const hold = setTimeout(() => {
      setState('leaving');
    }, TIMING.hintVisible);
    return () => clearTimeout(hold);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reveal]);

  useEffect(() => {
    if (state !== 'leaving') return;
    const fade = setTimeout(() => setState('gone'), TIMING.hintFade);
    return () => clearTimeout(fade);
  }, [state]);

  return state;
}

export function HoldFeedback({
  locale,
  hintState,
  progress,
  reducedMotion
}: {
  locale: Locale;
  hintState: HintState;
  /** 0 = idle, 1 = armed. */
  progress: number;
  reducedMotion: boolean;
}) {
  const copy = copyFor(locale);
  const armed = progress >= 1;
  const holdState = progress <= 0 ? 'idle' : armed ? 'armed' : 'progressing';

  return (
    <>
      {/* Never interactive, so it never takes pointer events from the gesture. */}
      <div className="d-entrance__foot">
        <p
          className="d-entrance__hint"
          lang={copy.htmlLang}
          data-state={hintState}
          hidden={hintState === 'gone'}
        >
          {copy.holdHint}
        </p>
      </div>

      <div className="d-entrance__hold" aria-hidden="true" data-state={holdState}>
        {!reducedMotion && (
          <svg className="d-hold__ring" viewBox="0 0 32 32" focusable="false">
            <circle className="d-hold__track" cx="16" cy="16" r={RING_RADIUS} />
            <circle
              className="d-hold__fill"
              cx="16"
              cy="16"
              r={RING_RADIUS}
              strokeDasharray={RING_CIRCUMFERENCE}
              strokeDashoffset={RING_CIRCUMFERENCE * (1 - Math.min(1, Math.max(0, progress)))}
            />
          </svg>
        )}
        <span className="d-hold__label" lang={copy.htmlLang}>
          {progress <= 0 ? '' : armed ? copy.holdThreshold : copy.holdProgress}
        </span>
      </div>
    </>
  );
}

export { RING_CIRCUMFERENCE };
