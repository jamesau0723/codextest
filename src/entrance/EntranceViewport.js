/**
 * EntranceViewport (spec 7.3, 7.8).
 *
 * Responsibilities:
 *  - dynamic-height fallback ONLY for browsers without 100dvh
 *  - report the viewport shape so crop alignment can follow it
 *  - notify on resize / rotation / browser-chrome change, coalesced to one frame
 *
 * It deliberately owns no scene state. Viewport changes must never restart the
 * video or the entrance sequence, so this module only ever reports geometry.
 */

export class EntranceViewport {
  /**
   * @param {object} options
   * @param {HTMLElement} options.root       entrance root element
   * @param {FrameLoop}   options.frameLoop  shared rAF loop
   * @param {(geometry) => void} options.onChange
   */
  constructor({ root, frameLoop, onChange }) {
    this.root = root;
    this.frameLoop = frameLoop;
    this.onChange = onChange;
    this.disposed = false;
    this.pending = false;
    this.last = null;

    // Populate the legacy height variable only when `dvh` is genuinely absent.
    // Where dvh works we install no competing JavaScript height observer.
    this.needsLegacyHeight = !supportsDvh();

    this.handleResize = this.handleResize.bind(this);
    this.flush = this.flush.bind(this);

    globalThis.addEventListener('resize', this.handleResize, { passive: true });
    globalThis.addEventListener('orientationchange', this.handleResize, { passive: true });

    this.visualViewport = globalThis.visualViewport || null;
    if (this.visualViewport) {
      this.visualViewport.addEventListener('resize', this.handleResize, { passive: true });
      this.visualViewport.addEventListener('scroll', this.handleResize, { passive: true });
    }

    this.measure();
    this.apply();
  }

  /** Read the available browser content rectangle. */
  measure() {
    const vv = this.visualViewport;
    // innerWidth/innerHeight describe the layout viewport; visualViewport
    // reflects browser-chrome and pinch-zoom state where it is supported.
    const width = globalThis.innerWidth || document.documentElement.clientWidth || 0;
    const height = globalThis.innerHeight || document.documentElement.clientHeight || 0;
    const visibleHeight = vv && typeof vv.height === 'number' ? vv.height : height;
    const scale = vv && typeof vv.scale === 'number' ? vv.scale : 1;

    this.geometry = {
      width,
      height,
      visibleHeight,
      scale,
      ratio: height > 0 ? width / height : 1,
      shape: shapeFor(width, height)
    };
    return this.geometry;
  }

  apply() {
    if (this.disposed || !this.root) return;
    if (this.needsLegacyHeight) {
      // At normal zoom only: under pinch zoom visualViewport.height shrinks, and
      // shrinking the root to match would fight the user's intentional zoom.
      const scale = this.geometry.scale || 1;
      const height = scale > 1.01 ? this.geometry.height : Math.round(this.geometry.visibleHeight);
      this.root.style.setProperty('--entrance-legacy-height', `${height}px`);
    }
    this.root.dataset.shape = this.geometry.shape;
  }

  handleResize() {
    if (this.disposed || this.pending) return;
    this.pending = true;
    // Coalesced into the next frame — no debounce delay that would leave a
    // visible gap, and no polling.
    this.frameLoop.add(this.flush);
  }

  flush() {
    this.frameLoop.remove(this.flush);
    this.pending = false;
    if (this.disposed) return;
    const previous = this.last;
    const geometry = this.measure();
    this.apply();
    this.last = { ...geometry };
    if (typeof this.onChange === 'function') {
      this.onChange(geometry, previous);
    }
  }

  destroy() {
    if (this.disposed) return;
    this.disposed = true;
    this.frameLoop.remove(this.flush);
    globalThis.removeEventListener('resize', this.handleResize);
    globalThis.removeEventListener('orientationchange', this.handleResize);
    if (this.visualViewport) {
      this.visualViewport.removeEventListener('resize', this.handleResize);
      this.visualViewport.removeEventListener('scroll', this.handleResize);
    }
    this.root?.style.removeProperty('--entrance-legacy-height');
  }
}

export function supportsDvh() {
  return Boolean(globalThis.CSS && CSS.supports && CSS.supports('height', '100dvh'));
}

function shapeFor(width, height) {
  if (!height) return 'balanced';
  const ratio = width / height;
  if (ratio < 0.7) return 'narrow';
  if (ratio < 1.2) return 'balanced';
  return 'wide';
}
