/**
 * SceneClock — a monotonic, freezable elapsed-time source.
 *
 * Every animated timeline in the entrance (typing, the word passage, the final
 * transformation, hold progress) is driven from one frame loop reading this
 * clock, rather than from chains of setTimeout. That keeps the video, the scene
 * state and the gesture in sync through pauses, hidden tabs and held pointers,
 * and lets a hold be cancelled by restoring an exact saved scene time.
 *
 * Freezing is reference-counted by reason, so a hold that begins while the user
 * has already paused does not resume playback when the hold is released.
 */

const now = () =>
  (globalThis.performance && typeof globalThis.performance.now === 'function'
    ? globalThis.performance.now()
    : Date.now());

export class SceneClock {
  constructor() {
    this.base = 0;
    this.startedAt = null;
    this.freezes = new Set();
  }

  /** Elapsed milliseconds since the last reset, excluding frozen time. */
  get elapsed() {
    return this.startedAt === null ? this.base : this.base + (now() - this.startedAt);
  }

  get running() {
    return this.startedAt !== null;
  }

  get frozen() {
    return this.freezes.size > 0;
  }

  /** Restart the timeline at `at` milliseconds; runs unless something froze it. */
  reset(at = 0) {
    this.base = at;
    this.startedAt = this.freezes.size === 0 ? now() : null;
  }

  /** Jump to an exact elapsed value, preserving the running/frozen state. */
  seek(at) {
    this.base = at;
    if (this.startedAt !== null) this.startedAt = now();
  }

  freeze(reason) {
    if (this.freezes.has(reason)) return;
    if (this.freezes.size === 0 && this.startedAt !== null) {
      this.base += now() - this.startedAt;
      this.startedAt = null;
    }
    this.freezes.add(reason);
  }

  thaw(reason) {
    if (!this.freezes.delete(reason)) return;
    if (this.freezes.size === 0 && this.startedAt === null) {
      this.startedAt = now();
    }
  }

  clearFreezes() {
    this.freezes.clear();
    if (this.startedAt === null) this.startedAt = now();
  }
}

/**
 * FrameLoop — one shared requestAnimationFrame loop.
 *
 * Callbacks receive the monotonic frame timestamp. Using a single loop for the
 * scene timeline, the hold-progress ring and viewport writes keeps layout reads
 * and writes coalesced into the same frame instead of competing observers.
 */
export class FrameLoop {
  constructor(raf = globalThis.requestAnimationFrame?.bind(globalThis), caf = globalThis.cancelAnimationFrame?.bind(globalThis)) {
    this.raf = raf || ((cb) => setTimeout(() => cb(now()), 16));
    this.caf = caf || clearTimeout;
    this.subscribers = new Set();
    this.handle = null;
    this.tick = this.tick.bind(this);
  }

  add(fn) {
    this.subscribers.add(fn);
    this.start();
    return () => this.remove(fn);
  }

  remove(fn) {
    this.subscribers.delete(fn);
    if (this.subscribers.size === 0) this.stop();
  }

  start() {
    if (this.handle === null && this.subscribers.size > 0) {
      this.handle = this.raf(this.tick);
    }
  }

  stop() {
    if (this.handle !== null) {
      this.caf(this.handle);
      this.handle = null;
    }
  }

  tick(timestamp) {
    this.handle = null;
    for (const fn of Array.from(this.subscribers)) {
      try {
        fn(timestamp);
      } catch (error) {
        console.error('[d-entrance] frame callback failed', error);
        this.subscribers.delete(fn);
      }
    }
    this.start();
  }

  destroy() {
    this.subscribers.clear();
    this.stop();
  }
}

export const monotonicNow = now;
