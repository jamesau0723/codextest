/**
 * HoldToSkip (spec 6).
 *
 * One Pointer Events state machine for mouse, touch and pen — not duplicate
 * touch and mouse timers.
 *
 * Contract:
 *  - press anywhere inside the entrance starts a hold; the scene clock suspends
 *  - 0–150ms shows nothing, so an ordinary tap still looks like a tap
 *  - 150–1499ms shows a progress ring (progress includes the initial 150ms)
 *  - >=1500ms arms the skip and begins a non-interactive homepage preview
 *  - release after the threshold commits; release before it cancels and lets
 *    the pressed control's ordinary activation happen
 *  - the threshold race is decided by elapsed time at release, not by whether a
 *    timer callback happened to have fired
 *  - a successful or movement-cancelled hold swallows its synthetic click, so
 *    the homepage is never clicked under the user's finger
 */
import { TIMING } from './EntranceContentData.js';
import { monotonicNow } from './clock.js';

const STAGE = {
  idle: 'idle',
  pressed: 'pressed',
  progressing: 'progressing',
  armed: 'armed'
};

export class HoldToSkip {
  /**
   * @param {object} options
   * @param {HTMLElement} options.root
   * @param {FrameLoop} options.frameLoop
   * @param {object} options.callbacks
   *   onStart()            – suspend the scene clock, snapshot state
   *   onProgress(ratio)    – 0..1, only once past the indicator delay
   *   onArm()              – threshold reached; begin homepage preview
   *   onCommit()           – released past threshold; commit the exit
   *   onCancel()           – restore the exact pre-hold scene and pause state
   */
  constructor({ root, frameLoop, callbacks = {} }) {
    this.root = root;
    this.frameLoop = frameLoop;
    this.callbacks = callbacks;
    this.disposed = false;

    this.stage = STAGE.idle;
    this.pointerId = null;
    this.startX = 0;
    this.startY = 0;
    this.startedAt = 0;
    this.pressedTarget = null;
    this.suppressNextClick = false;

    this.onPointerDown = this.onPointerDown.bind(this);
    this.onPointerMove = this.onPointerMove.bind(this);
    this.onPointerUp = this.onPointerUp.bind(this);
    this.onPointerCancel = this.onPointerCancel.bind(this);
    this.onLostCapture = this.onLostCapture.bind(this);
    this.onClickCapture = this.onClickCapture.bind(this);
    this.onWindowBlur = this.onWindowBlur.bind(this);
    this.onVisibilityChange = this.onVisibilityChange.bind(this);
    this.onContextMenu = this.onContextMenu.bind(this);
    this.tick = this.tick.bind(this);

    root.addEventListener('pointerdown', this.onPointerDown);
    root.addEventListener('pointermove', this.onPointerMove);
    root.addEventListener('pointerup', this.onPointerUp);
    root.addEventListener('pointercancel', this.onPointerCancel);
    root.addEventListener('lostpointercapture', this.onLostCapture);
    root.addEventListener('contextmenu', this.onContextMenu);
    // Capture phase, so a swallowed click never reaches any handler.
    globalThis.addEventListener('click', this.onClickCapture, true);
    globalThis.addEventListener('blur', this.onWindowBlur);
    globalThis.document.addEventListener('visibilitychange', this.onVisibilityChange);
  }

  get active() {
    return this.stage !== STAGE.idle;
  }

  get armed() {
    return this.stage === STAGE.armed;
  }

  onPointerDown(event) {
    if (this.disposed) return;
    // Never intercept right mouse-button holds.
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (this.stage !== STAGE.idle) {
      // A second pointer cancels; a new press is then required.
      this.cancel('second-pointer');
      return;
    }

    this.stage = STAGE.pressed;
    this.pointerId = event.pointerId;
    this.startX = event.clientX;
    this.startY = event.clientY;
    this.startedAt = monotonicNow();
    this.pressedTarget = event.target;

    // Deliberately NOT capturing the pointer onto the root: capturing would
    // retarget events and break native button activation. The root already
    // spans the entrance, and lostpointercapture is still handled for the case
    // where a native control captures implicitly.
    this.callbacks.onStart?.();
    this.frameLoop.add(this.tick);
  }

  onPointerMove(event) {
    if (this.stage === STAGE.idle || event.pointerId !== this.pointerId) return;
    const dx = event.clientX - this.startX;
    const dy = event.clientY - this.startY;
    if (Math.hypot(dx, dy) > TIMING.holdTolerancePx) {
      // Past tolerance: cancel, swallow the click so the press cannot also
      // activate whatever is under the pointer, and require a fresh press.
      this.suppressNextClick = true;
      this.cancel('movement');
    }
  }

  onPointerUp(event) {
    if (this.stage === STAGE.idle || event.pointerId !== this.pointerId) return;

    // Decide by elapsed time at release rather than trusting that the frame
    // callback already ran — a dropped frame must not lose a valid hold.
    const elapsed = monotonicNow() - this.startedAt;

    if (elapsed >= TIMING.holdThreshold) {
      // Swallow this gesture's click so the homepage is not clicked under the
      // finger as the entrance leaves.
      this.suppressNextClick = true;
      this.finish();
      this.callbacks.onCommit?.();
      return;
    }

    // Released early: cancel the hold and let the pressed control's ordinary
    // activation proceed (the click is NOT swallowed here).
    this.cancel('released-early');
  }

  onPointerCancel(event) {
    if (this.stage === STAGE.idle || event.pointerId !== this.pointerId) return;
    this.cancel('pointercancel');
  }

  onLostCapture(event) {
    if (this.stage === STAGE.idle || event.pointerId !== this.pointerId) return;
    this.cancel('lostpointercapture');
  }

  onContextMenu() {
    // Native context menu or assistive-technology interception: cancel safely.
    if (this.stage !== STAGE.idle) this.cancel('contextmenu');
  }

  onWindowBlur() {
    if (this.stage !== STAGE.idle) this.cancel('blur');
  }

  onVisibilityChange() {
    if (globalThis.document.visibilityState === 'hidden' && this.stage !== STAGE.idle) {
      this.cancel('hidden');
    }
  }

  onClickCapture(event) {
    if (!this.suppressNextClick) return;
    this.suppressNextClick = false;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  }

  /** Viewport geometry changed mid-hold: cancel without navigating. */
  cancelForViewportChange() {
    if (this.stage !== STAGE.idle) this.cancel('viewport');
  }

  tick() {
    if (this.stage === STAGE.idle || this.disposed) return;
    const elapsed = monotonicNow() - this.startedAt;

    if (elapsed >= TIMING.holdThreshold) {
      if (this.stage !== STAGE.armed) {
        this.stage = STAGE.armed;
        this.callbacks.onProgress?.(1);
        this.callbacks.onArm?.();
      }
      return;
    }

    if (elapsed >= TIMING.holdIndicatorDelay) {
      if (this.stage !== STAGE.progressing) this.stage = STAGE.progressing;
      // Progress includes the initial 150ms, so the ring reflects real elapsed
      // time against the 1500ms threshold rather than restarting at 150ms.
      this.callbacks.onProgress?.(Math.min(1, elapsed / TIMING.holdThreshold));
    }
  }

  finish() {
    this.frameLoop.remove(this.tick);
    this.stage = STAGE.idle;
    this.pointerId = null;
    this.pressedTarget = null;
  }

  cancel(reason) {
    if (this.stage === STAGE.idle) return;
    this.finish();
    this.callbacks.onCancel?.(reason);
  }

  destroy() {
    if (this.disposed) return;
    this.disposed = true;
    this.finish();
    this.root.removeEventListener('pointerdown', this.onPointerDown);
    this.root.removeEventListener('pointermove', this.onPointerMove);
    this.root.removeEventListener('pointerup', this.onPointerUp);
    this.root.removeEventListener('pointercancel', this.onPointerCancel);
    this.root.removeEventListener('lostpointercapture', this.onLostCapture);
    this.root.removeEventListener('contextmenu', this.onContextMenu);
    globalThis.removeEventListener('blur', this.onWindowBlur);
    globalThis.document.removeEventListener('visibilitychange', this.onVisibilityChange);
    // Leave the click swallower installed briefly so a commit's trailing click
    // cannot leak through after teardown.
    setTimeout(() => {
      globalThis.removeEventListener('click', this.onClickCapture, true);
    }, 0);
  }
}

export { STAGE as HOLD_STAGE };
