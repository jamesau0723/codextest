/**
 * PerformanceBackground (spec 7.1–7.7).
 *
 * Owns the full-viewport cover geometry, one session-stable source, responsive
 * crop alignment, the matching poster, pause, and every media-failure path.
 *
 * Invariants:
 *  - video and poster both fill the root and use object-fit: cover
 *  - exactly one source is requested for the entrance session
 *  - a rotation or resize realigns the crop but never reloads or restarts media
 *  - nothing here can block the UI: the entrance renders before media is ready
 */
import { selectSource, alignmentFor, viewportShape } from './mediaConfig.js';

export class PerformanceBackground {
  /**
   * @param {object} options
   * @param {HTMLElement} options.root
   * @param {HTMLVideoElement} options.video
   * @param {HTMLImageElement} options.poster
   * @param {object} options.media        resolved media configuration
   * @param {string} options.shape        initial viewport shape
   * @param {boolean} options.reducedMotion
   */
  constructor({ root, video, poster, media, shape, reducedMotion }) {
    this.root = root;
    this.video = video;
    this.poster = poster;
    this.media = media;
    this.reducedMotion = Boolean(reducedMotion);
    this.disposed = false;
    this.paused = false;
    this.videoReady = false;
    this.failed = false;
    this.posterFailed = false;

    // One source is chosen now and kept for the whole entrance session, so a
    // rotation cannot trigger a second download or a timeline jump.
    this.source = selectSource(shape, media);

    this.handleLoadedData = this.handleLoadedData.bind(this);
    this.handleError = this.handleError.bind(this);
    this.handlePosterError = this.handlePosterError.bind(this);

    this.mount(shape);
  }

  mount(shape) {
    this.align(shape);

    const { src, poster, type } = this.source;

    if (poster && this.poster) {
      this.poster.addEventListener('error', this.handlePosterError, { once: true });
      this.poster.src = poster;
      this.poster.hidden = false;
    } else if (this.poster) {
      // No poster configured: the scrim over plain black is the base layer.
      this.poster.hidden = true;
      this.root.dataset.poster = 'absent';
    }

    if (!src) {
      // No video configured at all. Documented failure state, not a loading
      // gate: poster (if any) shows, everything else keeps working.
      this.failed = true;
      this.root.dataset.media = poster ? 'poster-only' : 'none';
      if (this.video) this.video.hidden = true;
      return;
    }

    if (this.reducedMotion) {
      // Reduced motion uses a still image; do not fetch or autoplay the video.
      this.root.dataset.media = poster ? 'reduced-still' : 'none';
      if (this.video) this.video.hidden = true;
      return;
    }

    this.root.dataset.media = 'loading';
    this.video.addEventListener('loadeddata', this.handleLoadedData);
    this.video.addEventListener('error', this.handleError);
    this.video.muted = true;
    this.video.defaultMuted = true;
    this.video.playsInline = true;
    this.video.setAttribute('playsinline', '');
    this.video.setAttribute('webkit-playsinline', '');
    this.video.loop = Boolean(this.media.loop);
    this.video.preload = 'auto';
    this.video.controls = false;
    if (poster) this.video.poster = poster;
    if (type) this.video.setAttribute('data-type', type);
    this.video.src = src;
    // Video stays visually hidden until a displayable frame exists; the poster
    // underneath keeps the same cover rectangle in the meantime.
    this.video.hidden = false;
    this.video.style.opacity = '0';
    this.attemptPlay();
  }

  attemptPlay() {
    if (this.disposed || !this.video || this.failed) return;
    const attempt = this.video.play();
    if (attempt && typeof attempt.catch === 'function') {
      attempt.catch(() => {
        if (this.disposed || this.failed) return;
        // play() also rejects when the source failed to load. That is a media
        // error, not an autoplay denial, and must not overwrite the error state.
        if (this.video.error) {
          this.handleError();
          return;
        }
        // Autoplay denial is not an error state for the entrance: the poster
        // remains, and every control keeps working.
        this.root.dataset.media = 'autoplay-blocked';
      });
    }
  }

  handleLoadedData() {
    if (this.disposed) return;
    this.videoReady = true;
    this.root.dataset.media = 'ready';
    this.video.style.opacity = '1';
    // An entrance pause must not be overridden by a later media-ready event.
    if (this.paused) {
      this.video.pause();
    } else {
      this.attemptPlay();
    }
  }

  handleError() {
    if (this.disposed) return;
    this.failed = true;
    this.videoReady = false;
    this.video.hidden = true;
    this.root.dataset.media = this.hasPoster() ? 'poster-only' : 'none';
  }

  /** A poster counts only while it is configured AND has not failed to load. */
  hasPoster() {
    return Boolean(this.source.poster) && !this.posterFailed;
  }

  handlePosterError() {
    if (this.disposed) return;
    // Poster also failed: plain black behind white UI. Never a collapsed area.
    this.posterFailed = true;
    this.poster.hidden = true;
    this.root.dataset.poster = 'failed';
    if (this.failed) this.root.dataset.media = 'none';
  }

  /** Re-point the crop for a new viewport shape. CSS handles the fitting. */
  align(shape) {
    if (this.disposed || !this.root) return;
    const alignment = alignmentFor(this.source, shape);
    this.root.style.setProperty('--video-position-x', alignment.x);
    this.root.style.setProperty('--video-position-y', alignment.y);
    this.root.dataset.crop = `${alignment.x} ${alignment.y}`;
  }

  /** Called on resize/rotation. Realigns only; never reloads. */
  handleViewportChange(geometry) {
    this.align(geometry.shape || viewportShape(geometry.width, geometry.height));
  }

  setPaused(paused) {
    this.paused = Boolean(paused);
    if (this.disposed || !this.video || this.failed || this.reducedMotion) return;
    if (this.paused) this.video.pause();
    else this.attemptPlay();
  }

  /**
   * Hand the still-playing element to the homepage rather than destroying it,
   * when the homepage reuses the same video (spec: normal entry must not
   * restart a reused video).
   */
  releaseForReuse() {
    this.disposed = true;
    this.detachListeners();
    return this.videoReady ? this.video : null;
  }

  detachListeners() {
    this.video?.removeEventListener('loadeddata', this.handleLoadedData);
    this.video?.removeEventListener('error', this.handleError);
    this.poster?.removeEventListener('error', this.handlePosterError);
  }

  destroy() {
    if (this.disposed) {
      this.detachListeners();
      return;
    }
    this.disposed = true;
    this.detachListeners();
    if (this.video) {
      try {
        this.video.pause();
        this.video.removeAttribute('src');
        this.video.load();
      } catch {
        /* releasing entrance-only playback is best-effort */
      }
    }
  }
}
