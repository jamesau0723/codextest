/**
 * EntranceController (spec 2, 8, 9, 10).
 *
 * Owns scene state, the frame-driven timeline, focus, pause, the hold gesture
 * and completion. Viewport state is deliberately kept out of scene state, so a
 * rotation or resize can never restart the video or the sequence.
 */
import { TIMING, copyFor } from './EntranceContentData.js';
import { SceneClock, FrameLoop } from './clock.js';
import { EntranceViewport } from './EntranceViewport.js';
import { PerformanceBackground } from './PerformanceBackground.js';
import { EntranceContent } from './EntranceContent.js';
import { EntranceControls } from './EntranceControls.js';
import { HoldToSkip } from './HoldToSkip.js';
import { MEDIA, mediaFromOverride } from './mediaConfig.js';
import { applyLocaleToDocument, syncLocaleToUrl } from './locale.js';
import { writeLocale, writeOutcome } from './storage.js';

export const STATE = {
  LANGUAGE: 'LANGUAGE',
  QUESTION_1: 'QUESTION_1',
  QUESTION_2: 'QUESTION_2',
  WORDS: 'WORDS',
  FINAL_D: 'FINAL_D',
  EXIT_PREVIEW: 'EXIT_PREVIEW',
  EXITING: 'EXITING',
  CLOSED: 'CLOSED'
};

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export class EntranceController {
  /**
   * @param {object} options
   * @param {HTMLElement} options.mount      top-level overlay/portal root
   * @param {HTMLElement} options.siteRoot   page content to make inert
   * @param {string} options.locale          provisional locale
   * @param {object} [options.media]         media config override (tests)
   * @param {boolean} [options.reducedMotion]
   * @param {HTMLElement} [options.returnFocusTo] for Replay
   * @param {(outcome, context) => void} [options.onExit]
   */
  constructor(options) {
    const {
      mount,
      siteRoot,
      locale,
      media,
      reducedMotion,
      returnFocusTo = null,
      onExit
    } = options;

    this.mount = mount;
    this.siteRoot = siteRoot;
    this.locale = locale;
    this.returnFocusTo = returnFocusTo;
    this.onExit = onExit;
    this.media = mediaFromOverride(media);
    this.reducedMotion =
      reducedMotion !== undefined
        ? Boolean(reducedMotion)
        : globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches || false;

    this.state = STATE.LANGUAGE;
    this.exiting = false;
    this.destroyed = false;
    this.motionPaused = false;
    this.localeConfirmed = false;
    this.sceneState = null;
    this.previousBodyOverflow = '';
    this.previousActiveElement = document.activeElement;

    this.frameLoop = new FrameLoop();
    this.clock = new SceneClock();

    this.tick = this.tick.bind(this);
    this.onKeyDown = this.onKeyDown.bind(this);
    this.onVisibilityChange = this.onVisibilityChange.bind(this);

    this.buildDom();
    this.lockScroll();

    this.viewport = new EntranceViewport({
      root: this.root,
      frameLoop: this.frameLoop,
      onChange: (geometry) => this.handleViewportChange(geometry)
    });

    this.background = new PerformanceBackground({
      root: this.root,
      video: this.root.querySelector('.d-entrance__video'),
      poster: this.root.querySelector('.d-entrance__poster'),
      media: this.media,
      shape: this.viewport.geometry.shape,
      reducedMotion: this.reducedMotion
    });

    this.content = new EntranceContent({
      root: this.root,
      container: this.root.querySelector('.d-entrance__content'),
      locale: this.locale,
      reducedMotion: this.reducedMotion
    });

    this.controls = new EntranceControls({
      root: this.root,
      locale: this.locale,
      reducedMotion: this.reducedMotion,
      onSkip: () => this.commitExit('skipped'),
      onTogglePause: () => this.togglePause()
    });

    this.hold = new HoldToSkip({
      root: this.root,
      frameLoop: this.frameLoop,
      callbacks: {
        onStart: () => this.handleHoldStart(),
        onProgress: (ratio) => this.controls.setHoldProgress(ratio),
        onArm: () => this.handleHoldArm(),
        onCommit: () => this.commitExit('skipped', { fromHold: true }),
        onCancel: () => this.handleHoldCancel()
      }
    });

    document.addEventListener('keydown', this.onKeyDown, true);
    document.addEventListener('visibilitychange', this.onVisibilityChange);

    // A display font that swaps in after the first fit would leave the word set
    // sized against the fallback's metrics, so re-fit once fonts settle. The
    // layout is already reserved, so this adjusts size without shifting
    // controls, and it is a no-op where no webfont is used.
    document.fonts?.ready
      .then(() => {
        if (!this.destroyed) this.content.fitWords();
      })
      .catch(() => { /* font loading is best-effort */ });

    this.frameLoop.add(this.tick);
    this.enterState(STATE.LANGUAGE);
  }

  // ── DOM ────────────────────────────────────────────────────────────────────

  buildDom() {
    const template = document.getElementById('d-entrance-template');
    if (!template) throw new Error('[d-entrance] template #d-entrance-template is missing');
    const fragment = template.content.cloneNode(true);
    this.root = fragment.querySelector('.d-entrance');
    this.root.setAttribute('aria-label', copyFor(this.locale).entranceLabel);
    if (this.reducedMotion) this.root.dataset.reducedMotion = 'true';
    this.mount.appendChild(fragment);
  }

  lockScroll() {
    this.previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Keep the underlying page out of the accessibility and focus order.
    this.siteRoot?.setAttribute('inert', '');
    this.siteRoot?.setAttribute('aria-hidden', 'true');
  }

  unlockScroll() {
    document.body.style.overflow = this.previousBodyOverflow;
    this.siteRoot?.removeAttribute('inert');
    this.siteRoot?.removeAttribute('aria-hidden');
  }

  // ── Scene state ────────────────────────────────────────────────────────────

  enterState(next) {
    this.state = next;
    this.root.dataset.state = next;
    this.clock.reset(0);
    if (this.motionPaused) this.clock.freeze('pause');

    switch (next) {
      case STATE.LANGUAGE:
        this.sceneState = this.content.renderLanguage({
          onSelect: (locale) => this.selectLanguage(locale)
        });
        this.focusScene(this.sceneState.heading);
        break;

      case STATE.QUESTION_1:
        this.sceneState = this.content.renderQuestion(1, {
          onAdvance: () => this.enterState(STATE.QUESTION_2)
        });
        this.focusScene(this.sceneState.heading);
        break;

      case STATE.QUESTION_2:
        this.sceneState = this.content.renderQuestion(2, {
          onAdvance: () => this.startWordPassage()
        });
        this.focusScene(this.sceneState.heading);
        break;

      case STATE.WORDS:
        this.sceneState = this.content.renderWords({
          onEnter: () => this.commitExit('completed')
        });
        this.focusScene(this.sceneState.panel);
        break;

      case STATE.FINAL_D:
        this.sceneState = this.content.renderFinal({
          onEnter: () => this.commitExit('completed')
        });
        this.focusScene(this.sceneState.heading);
        break;

      default:
        break;
    }
  }

  startWordPassage() {
    if (this.reducedMotion) {
      // Reduced motion replaces the timed passage with a static list.
      this.state = STATE.WORDS;
      this.root.dataset.state = STATE.WORDS;
      this.clock.reset(0);
      this.sceneState = this.content.renderStaticWords({
        onEnter: () => this.commitExit('completed')
      });
      this.focusScene(this.sceneState.heading);
      return;
    }
    this.enterState(STATE.WORDS);
  }

  focusScene(target) {
    const node = target instanceof HTMLElement ? target : this.sceneState?.panel;
    if (!node) return;
    if (!node.hasAttribute('tabindex')) node.tabIndex = -1;
    // Focus without scrolling: the background must not move.
    node.focus({ preventScroll: true });
  }

  selectLanguage(locale) {
    this.locale = locale;
    this.localeConfirmed = true;
    writeLocale(locale);
    applyLocaleToDocument(locale);
    syncLocaleToUrl(locale);
    this.content.setLocale(locale);
    this.controls.setLocale(locale);
    this.root.setAttribute('aria-label', copyFor(locale).entranceLabel);
    this.enterState(STATE.QUESTION_1);
  }

  // ── Frame loop ─────────────────────────────────────────────────────────────

  tick() {
    if (this.destroyed || this.exiting) return;
    const elapsed = this.clock.elapsed;

    switch (this.state) {
      case STATE.QUESTION_1:
      case STATE.QUESTION_2:
        this.content.updateTyping(this.sceneState, elapsed);
        break;

      case STATE.WORDS: {
        if (this.reducedMotion) break;
        const finished = this.content.updateWords(this.sceneState, elapsed);
        if (finished) this.enterState(STATE.FINAL_D);
        break;
      }

      case STATE.FINAL_D:
        // Runs once and then waits, without a time limit, for Enter/Skip/hold.
        this.content.updateFinal(this.sceneState, elapsed);
        break;

      default:
        break;
    }
  }

  // ── Pause ──────────────────────────────────────────────────────────────────

  togglePause() {
    this.setPaused(!this.motionPaused);
  }

  setPaused(paused) {
    if (this.motionPaused === paused) return;
    this.motionPaused = paused;
    if (paused) {
      this.clock.freeze('pause');
      // Already-typed text is completed immediately so it stays readable.
      if (this.state === STATE.QUESTION_1 || this.state === STATE.QUESTION_2) {
        this.content.completeTyping(this.sceneState);
      }
    } else {
      this.clock.thaw('pause');
    }
    this.background.setPaused(paused);
    this.controls.setPaused(paused);
    this.root.dataset.paused = String(paused);
  }

  // ── Hold gesture ───────────────────────────────────────────────────────────

  handleHoldStart() {
    // Suspend the scene clock for the duration of the hold, and remember the
    // exact scene time so a cancellation restores it rather than losing it.
    this.holdSnapshot = { state: this.state, elapsed: this.clock.elapsed };
    this.clock.freeze('hold');
    if (!this.motionPaused) this.background.setPaused(true);
  }

  handleHoldArm() {
    this.root.dataset.preview = 'true';
    this.previousState = this.state;
    this.state = STATE.EXIT_PREVIEW;
  }

  handleHoldCancel() {
    this.root.dataset.preview = 'false';
    if (this.state === STATE.EXIT_PREVIEW && this.previousState) {
      this.state = this.previousState;
      this.previousState = null;
    }
    this.controls.clearHold();
    if (this.holdSnapshot) {
      this.clock.seek(this.holdSnapshot.elapsed);
      this.holdSnapshot = null;
    }
    this.clock.thaw('hold');
    // Restore the pre-hold pause state — a hold started while paused must not
    // resume playback on release.
    this.background.setPaused(this.motionPaused);
  }

  // ── Keyboard ───────────────────────────────────────────────────────────────

  onKeyDown(event) {
    if (this.destroyed || this.exiting) return;

    if (event.key === 'Escape') {
      // Yield to any higher-priority dialog that needs Escape first.
      if (document.querySelector('dialog[open], [data-priority-dialog="true"]')) return;
      event.preventDefault();
      this.commitExit('skipped');
      return;
    }

    if (event.key === 'Tab') this.trapFocus(event);
  }

  trapFocus(event) {
    const focusable = Array.from(this.root.querySelectorAll(FOCUSABLE)).filter(
      (node) => node.offsetParent !== null || node === document.activeElement
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;

    if (event.shiftKey && (active === first || !this.root.contains(active))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  onVisibilityChange() {
    if (this.destroyed) return;
    if (document.visibilityState === 'hidden') {
      // Freeze playback and scene time; never fast-forward unseen words.
      this.clock.freeze('hidden');
      this.background.setPaused(true);
    } else {
      this.clock.thaw('hidden');
      this.background.setPaused(this.motionPaused);
    }
  }

  // ── Viewport ───────────────────────────────────────────────────────────────

  handleViewportChange(geometry) {
    if (this.destroyed) return;
    // Realign the crop and refit the words. Scene state, media and the clock
    // are untouched, so the sequence cannot restart.
    this.background.handleViewportChange(geometry);
    this.content.fitWords();
    // A geometry change cancels an in-progress hold without navigating.
    this.hold.cancelForViewportChange();
  }

  // ── Exit ───────────────────────────────────────────────────────────────────

  /**
   * @param {'completed'|'skipped'} outcome
   */
  commitExit(outcome, { fromHold = false } = {}) {
    // Single guard against double navigation and duplicate storage writes from
    // Skip, hold, Enter and Escape racing each other.
    if (this.exiting || this.destroyed) return;
    this.exiting = true;
    this.state = STATE.EXITING;
    this.root.dataset.state = STATE.EXITING;

    writeOutcome(outcome);

    const duration = outcome === 'completed' ? TIMING.exitNormal : TIMING.exitSkip;
    this.root.style.setProperty('--exit-duration', `${duration}ms`);
    this.root.dataset.preview = 'false';
    this.root.classList.add('is-exiting');

    // Hand a still-playing video to a homepage that reuses it, rather than
    // destroying and recreating it.
    const reuseHost = document.querySelector('[data-reuses-entrance-video]');
    let reusedVideo = null;
    if (reuseHost) {
      reusedVideo = this.background.releaseForReuse();
      if (reusedVideo) {
        reusedVideo.classList.add('site-hero__video');
        reuseHost.appendChild(reusedVideo);
      }
    }

    setTimeout(() => this.finalise(outcome, { fromHold, reusedVideo }), duration);
  }

  finalise(outcome, context) {
    if (this.destroyed) return;
    this.destroy();
    this.onExit?.(outcome, context);
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.state = STATE.CLOSED;

    document.removeEventListener('keydown', this.onKeyDown, true);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);

    this.hold.destroy();
    this.viewport.destroy();
    this.background.destroy();
    this.content.destroy();
    this.controls.destroy();
    this.frameLoop.remove(this.tick);
    this.frameLoop.destroy();

    this.unlockScroll();
    this.root.remove();
  }
}

export { MEDIA };
