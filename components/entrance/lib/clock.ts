/**
 * SceneClock — a monotonic, freezable elapsed-time source.
 *
 * The word passage and the final transformation are read from this clock inside
 * Framer Motion's `useAnimationFrame`, rather than from setTimeout chains, so a
 * hidden tab or a held pointer freezes them exactly where they were and a
 * cancelled hold can restore an exact scene time.
 *
 * Freezing is reference-counted by reason, so one freeze cannot undo another.
 */
const now = (): number =>
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();

export class SceneClock {
  private base = 0;
  private startedAt: number | null = null;
  private freezes = new Set<string>();

  /** Elapsed milliseconds since the last reset, excluding frozen time. */
  get elapsed(): number {
    return this.startedAt === null ? this.base : this.base + (now() - this.startedAt);
  }

  get frozen(): boolean {
    return this.freezes.size > 0;
  }

  /** Restart the timeline at `at` ms; runs unless something froze it. */
  reset(at = 0): void {
    this.base = at;
    this.startedAt = this.freezes.size === 0 ? now() : null;
  }

  /** Jump to an exact elapsed value, preserving running/frozen state. */
  seek(at: number): void {
    this.base = at;
    if (this.startedAt !== null) this.startedAt = now();
  }

  freeze(reason: string): void {
    if (this.freezes.has(reason)) return;
    if (this.freezes.size === 0 && this.startedAt !== null) {
      this.base += now() - this.startedAt;
      this.startedAt = null;
    }
    this.freezes.add(reason);
  }

  thaw(reason: string): void {
    if (!this.freezes.delete(reason)) return;
    if (this.freezes.size === 0 && this.startedAt === null) {
      this.startedAt = now();
    }
  }
}

export const monotonicNow = now;

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}
