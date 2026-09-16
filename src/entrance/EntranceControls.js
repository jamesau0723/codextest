/**
 * EntranceControls (spec 5, 6 feedback layer).
 *
 * Skip (top right, never disabled), pause/resume (bottom left), the hold hint
 * (bottom centre) and the hold-progress ring. All are safe-area aware via CSS;
 * this module owns their labels and state.
 */
import { copyFor, TIMING } from './EntranceContentData.js';

const RING_RADIUS = 13;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export class EntranceControls {
  constructor({ root, locale, reducedMotion, onSkip, onTogglePause }) {
    this.root = root;
    this.locale = locale;
    this.reducedMotion = Boolean(reducedMotion);
    this.onSkip = onSkip;
    this.onTogglePause = onTogglePause;
    this.paused = false;
    this.build();
  }

  get copy() {
    return copyFor(this.locale);
  }

  build() {
    const copy = this.copy;
    const ui = this.root.querySelector('.d-entrance__ui');

    // Skip is first in DOM order so it is the first reachable actionable
    // control for keyboard and screen-reader users.
    const skip = document.createElement('button');
    skip.type = 'button';
    skip.className = 'd-button d-entrance__skip';
    skip.dataset.action = 'skip';
    skip.lang = copy.htmlLang;
    skip.textContent = copy.skip;
    skip.addEventListener('click', () => this.onSkip?.());
    ui.prepend(skip);
    this.skip = skip;

    const foot = document.createElement('div');
    foot.className = 'd-entrance__foot';

    const pause = document.createElement('button');
    pause.type = 'button';
    pause.className = 'd-button d-button--compact d-entrance__pause';
    pause.dataset.action = 'pause';
    pause.lang = copy.htmlLang;
    pause.textContent = copy.pause;
    pause.addEventListener('click', () => this.onTogglePause?.());
    foot.appendChild(pause);
    this.pause = pause;

    const hint = document.createElement('p');
    hint.className = 'd-entrance__hint';
    hint.lang = copy.htmlLang;
    hint.textContent = copy.holdHint;
    foot.appendChild(hint);
    this.hint = hint;

    ui.appendChild(foot);

    // Hold feedback sits in a fixed safe location above the bottom hint and
    // must never steal pointer events from the gesture it is reporting on.
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

  setLocale(locale) {
    this.locale = locale;
    const copy = this.copy;
    for (const node of [this.skip, this.pause, this.hint, this.holdLabel]) {
      if (node) node.lang = copy.htmlLang;
    }
    this.skip.textContent = copy.skip;
    this.pause.textContent = this.paused ? copy.resume : copy.pause;
    this.hint.textContent = copy.holdHint;
  }

  setPaused(paused) {
    this.paused = Boolean(paused);
    const copy = this.copy;
    this.pause.textContent = this.paused ? copy.resume : copy.pause;
    this.pause.setAttribute('aria-pressed', String(this.paused));
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

  /** Swap Continue for Enter D labelling is owned by EntranceContent; the
   *  persistent controls never change position between scenes. */
  destroy() {
    this.skip?.remove();
    this.hold?.remove();
    this.pause?.closest('.d-entrance__foot')?.remove();
  }
}

export { RING_CIRCUMFERENCE, TIMING };
