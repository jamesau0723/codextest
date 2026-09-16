/**
 * Entrance media configuration (spec 7.6).
 *
 * The authentic D Festival performance recording is now wired up. It was
 * supplied as a 3840x2160 HEVC QuickTime master, 21.1s, one locked-off wide
 * shot of the soloist and orchestra that cross-dissolves at t=18.15 into a
 * 2.3s close-up of the pianist.
 *
 * ── EDITORIAL DECISION: APPROVED ────────────────────────────────────────────
 * The encodes are trimmed to 18.0s — the wide shot only, ending just before the
 * dissolve. The client approved this on 2026-09-16.
 *
 * The close-up could not survive a full-viewport crop: on a phone in portrait
 * only 26% of the source width is visible and the face sits right of centre, so
 * the alignment the wide shot needs (x=20%) left almost nothing but empty wall,
 * and even a centred crop cut the face in half.
 *
 * To change it, re-encode with a different trim via `npm run media` — nothing in
 * the code depends on the duration. The original file is untouched.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export type ViewportShape = 'narrow' | 'balanced' | 'wide';

export type CropAlignment = { x: string; y: string };

export type Encoding = { src: string; type: string };

export type MediaSource = {
  /** Primary encoding. Kept for readability and for configs with one file. */
  src: string | null;
  type?: string;
  /**
   * Alternative encodings of the same footage, best-supported first. The first
   * one the browser reports it can play wins.
   *
   * H.264 leads: it decodes in hardware essentially everywhere, which matters
   * for battery on a phone, and it is the only format older iOS Safari will
   * take. The VP9 alternative exists for Chromium builds compiled without
   * proprietary codecs — which includes the browser this project tests in.
   */
  encodings?: Encoding[];
  poster?: string | null;
  width?: number | null;
  height?: number | null;
  alignment?: Record<ViewportShape, CropAlignment>;
};

/**
 * Pick the first encoding the browser can play.
 *
 * `canPlayType` returns '', 'maybe' or 'probably'; anything non-empty counts.
 * If nothing matches we still return the primary, so the media-failure path
 * runs rather than the entrance silently rendering no video element at all.
 */
export function pickEncoding(
  source: MediaSource,
  canPlayType: (type: string) => string
): string | null {
  const candidates: Encoding[] =
    source.encodings && source.encodings.length > 0
      ? source.encodings
      : source.src
        ? [{ src: source.src, type: source.type ?? 'video/mp4' }]
        : [];
  for (const candidate of candidates) {
    if (canPlayType(candidate.type) !== '') return candidate.src;
  }
  return candidates[0]?.src ?? source.src ?? null;
}

export type MediaConfig = {
  master: MediaSource;
  /** Optional approved portrait edit; improves composition, never required. */
  portrait: MediaSource | null;
  /**
   * Optional smaller encode of the same footage for small viewports, so a
   * phone does not download the desktop master (spec 7.9).
   */
  compact: MediaSource | null;
  loop: boolean;
};

/** At or below this CSS width, prefer the compact encode when one exists. */
export const COMPACT_MAX_WIDTH = 900;

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
 * Crop alignment per viewport shape, chosen against the real footage.
 *
 * The soloist sits at roughly x=13% of the 3840px frame, well left of centre.
 * How much of that frame each shape actually shows:
 *
 *   narrow   390x844   26.0% of width   a centred crop loses the soloist entirely
 *   balanced 768x1024  42.2% of width   a centred crop puts him on the edge
 *   wide     1440x900  90.0% of width   everything fits; centre is fine
 *   wide     2560x1080 100% width, 75% height, cropped top and bottom
 *
 * So narrow and balanced are pulled left to hold the soloist and the keyboard
 * end of the piano, with the orchestra behind. Verified frame by frame across
 * the loop, which is a single continuous shot.
 */
const DEFAULT_ALIGNMENT: Record<ViewportShape, CropAlignment> = {
  narrow: { x: '20%', y: '50%' },
  balanced: { x: '30%', y: '50%' },
  wide: { x: '50%', y: '50%' }
};

export const MEDIA: MediaConfig = {
  master: {
    src: '/media/performance-master.mp4',
    type: 'video/mp4',
    encodings: [
      { src: '/media/performance-master.mp4', type: 'video/mp4; codecs="avc1.640028"' },
      { src: '/media/performance-master.webm', type: 'video/webm; codecs="vp9"' }
    ],
    poster: '/media/performance-poster.jpg',
    width: 1920,
    height: 1080,
    alignment: DEFAULT_ALIGNMENT
  },
  /** No approved portrait edit has been supplied; the master covers portrait. */
  portrait: null,
  compact: {
    src: '/media/performance-compact.mp4',
    type: 'video/mp4',
    encodings: [
      { src: '/media/performance-compact.mp4', type: 'video/mp4; codecs="avc1.4d401f"' },
      { src: '/media/performance-compact.webm', type: 'video/webm; codecs="vp9"' }
    ],
    poster: '/media/performance-poster.jpg',
    width: 1280,
    height: 720,
    alignment: DEFAULT_ALIGNMENT
  },
  loop: true
};

/**
 * Choose one source for the whole entrance session, so a rotation never
 * reloads the video or jumps its timeline.
 */
export function selectSource(
  shape: ViewportShape,
  viewportWidth = Number.POSITIVE_INFINITY,
  media: MediaConfig = MEDIA
): MediaSource {
  if (shape === 'narrow' && media.portrait?.src) return media.portrait;
  // A phone has no use for the desktop master; the compact encode is the same
  // footage at a smaller size.
  if (viewportWidth <= COMPACT_MAX_WIDTH && media.compact?.src) return media.compact;
  // A missing optional variant falls back to the master with cover — never to
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

  const overrideMaster = override.master;
  const master: MediaSource = overrideMaster
    ? {
        ...MEDIA.master,
        ...overrideMaster,
        /**
         * An override that names its own `src` must NOT inherit the production
         * `encodings`: `pickEncoding` prefers the list over the single src, so
         * the inherited production file would silently win and the override
         * would appear to do nothing.
         */
        encodings:
          overrideMaster.encodings ??
          ('src' in overrideMaster ? undefined : MEDIA.master.encodings)
      }
    : MEDIA.master;

  return {
    ...MEDIA,
    ...override,
    master,
    portrait: override.portrait === undefined ? MEDIA.portrait : override.portrait,
    // A caller supplying its own master must not silently inherit the
    // production compact encode alongside it.
    compact:
      override.compact === undefined ? (overrideMaster ? null : MEDIA.compact) : override.compact
  };
}
