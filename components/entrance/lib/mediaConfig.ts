/**
 * Entrance media configuration (spec 7.6).
 *
 * ── ASSET DEPENDENCY ─────────────────────────────────────────────────────────
 * The authentic D Festival performance recording HAS NOT BEEN SUPPLIED. The
 * default `master.src` is null. No filename here is presented as an existing
 * video: nothing has been invented.
 *
 * With no source configured the entrance runs its documented media-failure
 * path: the poster is attempted, and if that is also absent the entrance shows
 * full-screen black with white text and fully working controls.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export type ViewportShape = 'narrow' | 'balanced' | 'wide';

export type CropAlignment = { x: string; y: string };

export type MediaSource = {
  src: string | null;
  type?: string;
  poster?: string | null;
  width?: number | null;
  height?: number | null;
  alignment?: Record<ViewportShape, CropAlignment>;
};

export type MediaConfig = {
  master: MediaSource;
  portrait: MediaSource | null;
  loop: boolean;
};

/** Viewport-shape buckets. Editorial configuration, not a browser standard. */
export const SHAPE_THRESHOLDS = { narrow: 0.7, wide: 1.2 } as const;

export function viewportShape(width: number, height: number): ViewportShape {
  if (!height) return 'balanced';
  const ratio = width / height;
  if (ratio < SHAPE_THRESHOLDS.narrow) return 'narrow';
  if (ratio < SHAPE_THRESHOLDS.wide) return 'balanced';
  return 'wide';
}

/**
 * Crop alignment per viewport shape. Deliberately untuned at 50% 50%, because
 * tuning without the real recording would be a guess dressed as a decision.
 */
const DEFAULT_ALIGNMENT: Record<ViewportShape, CropAlignment> = {
  narrow: { x: '50%', y: '50%' },
  balanced: { x: '50%', y: '50%' },
  wide: { x: '50%', y: '50%' }
};

export const MEDIA: MediaConfig = {
  master: {
    src: null,
    type: 'video/mp4',
    poster: null,
    width: null,
    height: null,
    alignment: DEFAULT_ALIGNMENT
  },
  portrait: null,
  loop: true
};

/**
 * Choose one source for the whole entrance session, so a rotation never
 * reloads the video or jumps its timeline.
 */
export function selectSource(shape: ViewportShape, media: MediaConfig = MEDIA): MediaSource {
  if (shape === 'narrow' && media.portrait?.src) return media.portrait;
  // A missing optional portrait falls back to the master with cover — never to
  // `contain`, and never to a failure.
  return media.master;
}

export function alignmentFor(source: MediaSource, shape: ViewportShape): CropAlignment {
  const table = source.alignment ?? DEFAULT_ALIGNMENT;
  return table[shape] ?? DEFAULT_ALIGNMENT.balanced;
}

export function hasConfiguredMedia(media: MediaConfig = MEDIA): boolean {
  return Boolean(media.master.src || media.master.poster || media.portrait?.src);
}

/** Merge a partial override (tests, or a host app supplying real assets). */
export function mediaFromOverride(override?: Partial<MediaConfig> | null): MediaConfig {
  if (!override) return MEDIA;
  return {
    ...MEDIA,
    ...override,
    master: { ...MEDIA.master, ...(override.master ?? {}) },
    portrait: override.portrait === undefined ? MEDIA.portrait : override.portrait
  };
}
