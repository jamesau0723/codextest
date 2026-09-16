/**
 * EntranceControls — hold hint and hold-progress feedback.
 *
 * Deviations from spec v2.0 section 5, made at the client's request:
 *  - the persistent Skip control (top right) has been removed
 *  - the pause/resume control (bottom left) has been removed
 *  - the hold hint is no longer persistent: it appears once the language has
 *    been chosen, holds for 2s, then fades away for good
 *
 * Remaining exit routes: the 1500 ms hold anywhere, Escape, Continue through
 * the sequence, and Enter D. See docs/HANDOFF.md section 7.
 */
import { copyFor, TIMING } from './EntranceContentData.js';

const RING_RADIUS = 13;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export class EntranceControls {
  constructor({ root, locale, reducedMotion }) {
    this.root = root;
    this.locale = locale;
    this.reducedMotion = Boolean(reducedMotion);
    this.hintTimer = null;
    this.hintFadeTimer = null;
    this.hintShown = false;
    this.build();
  }

  get copy() {
    return copyFor(this.locale);
  }

  build() {
    const copy = this.copy;
    const ui = this.root.querySelector('.d-entrance__ui');

    const foot = document.createElement('div');
    foot.className = 'd-entrance__foot';

    const hint = document.createElement('p');
    hint.className = 'd-entrance__hint';
    hint.lang = copy.htmlLang;
    hint.textContent = copy.holdHint;
    // Hidden until the language has been chosen.
    hint.dataset.state = 'idle';
    foot.appendChild(hint);
    this.hint = hint;

    ui.appendChild(foot);

    // Hold feedback sits in a fixed safe location above the bottom hint and
    // never steals pointer events from the gesture it is reporting on.
    const hold = document.createElement('div');
    hold.className = 'd-entrance__hold';
    hold.setAttribute('aria-hidden', 'true');
    hold.dataset.state = 'idle';

    if (!this.reducedMotion) {
      hold.innerHTML = `
        <svg class="d-hold__ring" viewBox="0 0 32 32" focusable="false">
          <circle class="d-hold__track" cx="16" cy="16" r="${RING_RADIUS}" />
          <circle class="d-hold__fill" cx="16" cy="16" r="${RING_RADIUS}"
                  stroke-dasharray="${RING_CIRCUMFERENCE.toFixed(3)}"
                  stroke-dashoffset="${RING_CIRCUMFERENCE.toFixed(3)}" />
        </svg>`;
      this.ringFill = hold.querySelector('.d-hold__fill');
    }

    const label = document.createElement('span');
    label.className = 'd-hold__label';
    label.lang = copy.htmlLang;
    hold.appendChild(label);
    this.holdLabel = label;

    ui.appendChild(hold);
    this.hold = hold;
  }

  /**
   * Show the hold hint once, for `TIMING.hintVisible`, then fade it away.
   * Called when the language has been chosen; never repeats.
   */
  revealHint() {
    if (this.hintShown) return;
    this.hintShown = true;
    this.hint.dataset.state = 'visible';

    this.hintTimer = setTimeout(() => {
      this.hintTimer = null;
      this.hint.dataset.state = 'leaving';
      this.hintFadeTimer = setTimeout(() => {
        this.hintFadeTimer = null;
        // Out of the accessibility tree too, once it is gone for good.
        this.hint.dataset.state = 'gone';
        this.hint.hidden = true;
      }, TIMING.hintFade);
    }, TIMING.hintVisible);
  }

  setLocale(locale) {
    this.locale = locale;
    const copy = this.copy;
    if (this.hint) {
      this.hint.lang = copy.htmlLang;
      this.hint.textContent = copy.holdHint;
    }
    if (this.holdLabel) this.holdLabel.lang = copy.htmlLang;
  }

  /**
   * Report hold progress. Below the indicator delay nothing is drawn, so an
   * ordinary tap keeps its ordinary appearance.
   */
  setHoldProgress(ratio) {
    const copy = this.copy;
    if (ratio <= 0) {
      this.clearHold();
      return;
    }
    const armed = ratio >= 1;
    this.hold.dataset.state = armed ? 'armed' : 'progressing';
    this.holdLabel.textContent = armed ? copy.holdThreshold : copy.holdProgress;
    if (this.ringFill) {
      // Reduced motion replaces the filling ring with the static label only.
      this.ringFill.style.strokeDashoffset = String(
        RING_CIRCUMFERENCE * (1 - Math.min(1, Math.max(0, ratio)))
      );
    }
  }

  clearHold() {
    this.hold.dataset.state = 'idle';
    this.holdLabel.textContent = '';
    if (this.ringFill) this.ringFill.style.strokeDashoffset = String(RING_CIRCUMFERENCE);
  }

  destroy() {
    clearTimeout(this.hintTimer);
    clearTimeout(this.hintFadeTimer);
    this.hintTimer = null;
    this.hintFadeTimer = null;
    this.hold?.remove();
    this.hint?.closest('.d-entrance__foot')?.remove();
  }
}

export { RING_CIRCUMFERENCE };
