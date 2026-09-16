/**
 * Entrance media configuration (spec 7.6).
 *
 * ── ASSET DEPENDENCY ─────────────────────────────────────────────────────────
 * The authentic D Festival performance recording HAS NOT BEEN SUPPLIED to this
 * implementation. `master.src` is intentionally null. No filename here is
 * presented as an existing video: nothing has been invented.
 *
 * With `master.src === null` the entrance runs its documented media-failure
 * path: the poster is attempted, and if that is also absent the entrance shows
 * full-screen black with white text and fully working controls. The layout,
 * cover geometry, overlay, sequence, gestures and accessibility do not depend
 * on the media loading.
 *
 * To wire up the real footage, set `master.src` (and `poster`, `width`,
 * `height`). One clean landscape master is sufficient for every viewport;
 * `portrait` is an optional approved edit for better composition only.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** Viewport-shape buckets. Editorial configuration, not a browser standard. */
export const SHAPE_THRESHOLDS = { narrow: 0.7, wide: 1.2 };

export function viewportShape(width, height) {
  if (!height) return 'balanced';
  const ratio = width / height;
  if (ratio < SHAPE_THRESHOLDS.narrow) return 'narrow';
  if (ratio < SHAPE_THRESHOLDS.wide) return 'balanced';
  return 'wide';
}

/**
 * Crop alignment per viewport shape, as CSS object-position values.
 * Defaults are 50% 50% until the actual footage has been inspected; they are
 * deliberately NOT tuned, because tuning them without the real recording would
 * be a guess presented as an editorial decision.
 */
const DEFAULT_ALIGNMENT = {
  narrow: { x: '50%', y: '50%' },
  balanced: { x: '50%', y: '50%' },
  wide: { x: '50%', y: '50%' }
};

export const MEDIA = {
  /** The one required input. Replace with the supplied master recording. */
  master: {
    src: null,
    type: 'video/mp4',
    poster: null,
    width: null,
    height: null,
    alignment: DEFAULT_ALIGNMENT
  },

  /** Optional approved portrait edit of the same footage. Absent is fine. */
  portrait: null,

  /** Loop the background while motion is enabled. */
  loop: true
};

/**
 * Choose one source for the whole entrance session.
 *
 * The chosen source is kept for the session, including rotations, so a rotation
 * never reloads the video or jumps its timeline. A later Replay may choose
 * differently for the new orientation.
 */
export function selectSource(shape, media = MEDIA) {
  const portrait = media.portrait;
  if (shape === 'narrow' && portrait && portrait.src) {
    return { ...portrait, variant: 'portrait' };
  }
  // A missing optional portrait falls back to the master with cover — never to
  // `contain`, and never to a failure.
  return { ...media.master, variant: 'master' };
}

export function alignmentFor(source, shape) {
  const table = source?.alignment || DEFAULT_ALIGNMENT;
  return table[shape] || table.balanced || DEFAULT_ALIGNMENT.balanced;
}

/** True when no usable background media is configured at all. */
export function hasConfiguredMedia(media = MEDIA) {
  return Boolean(media.master?.src || media.master?.poster || media.portrait?.src);
}

/** Test seam: run the entrance against fixture media without editing this file. */
export function mediaFromOverride(override) {
  if (!override) return MEDIA;
  return {
    ...MEDIA,
    ...override,
    master: { ...MEDIA.master, ...(override.master || {}) },
    portrait: override.portrait === undefined ? MEDIA.portrait : override.portrait
  };
}
