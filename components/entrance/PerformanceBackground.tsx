'use client';

/**
 * PerformanceBackground (spec 7.1–7.7).
 *
 * Invariants:
 *  - video and poster both fill the root and use object-fit: cover
 *  - exactly one source is requested for the entrance session
 *  - a rotation or resize realigns the crop but never reloads or restarts media
 *  - nothing here can block the UI: the entrance renders before media is ready
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  alignmentFor,
  pickEncoding,
  selectSource,
  type MediaConfig,
  type ViewportShape
} from './lib/mediaConfig';

export type MediaState =
  | 'none'
  | 'loading'
  | 'ready'
  | 'poster-only'
  | 'autoplay-blocked'
  | 'reduced-still';

export function PerformanceBackground({
  media,
  shape,
  viewportWidth,
  reducedMotion,
  paused,
  videoRef,
  onStateChange
}: {
  media: MediaConfig;
  shape: ViewportShape;
  /** Decides between the desktop master and the smaller encode (spec 7.9). */
  viewportWidth: number;
  reducedMotion: boolean;
  paused: boolean;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  onStateChange?: (state: MediaState) => void;
}) {
  // The source is chosen once and kept for the whole session, so a rotation
  // cannot trigger a second download or a timeline jump.
  const [source] = useState(() => selectSource(shape, viewportWidth, media));
  // Negotiated once, alongside the source: one file is requested per session.
  const [src] = useState(() =>
    pickEncoding(source, (type) => {
      if (typeof document === 'undefined') return '';
      return document.createElement('video').canPlayType(type);
    })
  );
  const [state, setState] = useState<MediaState>('none');
  const [posterFailed, setPosterFailed] = useState(false);
  const failed = useRef(false);

  const alignment = useMemo(() => alignmentFor(source, shape), [source, shape]);
  const hasPoster = Boolean(source.poster) && !posterFailed;

  const report = (next: MediaState) => {
    setState(next);
    onStateChange?.(next);
  };

  useEffect(() => {
    if (!src) {
      failed.current = true;
      report(source.poster ? 'poster-only' : 'none');
      return;
    }
    if (reducedMotion) {
      // Reduced motion uses a still image: no video is fetched or autoplayed.
      report(source.poster ? 'reduced-still' : 'none');
      return;
    }
    report('loading');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, reducedMotion]);

  // Pause and resume follow the entrance, never the other way round.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src || reducedMotion || failed.current) return;
    if (paused) {
      video.pause();
      return;
    }
    const attempt = video.play();
    attempt?.catch(() => {
      if (failed.current) return;
      // play() also rejects when the source failed to load. That is a media
      // error, not an autoplay denial.
      if (video.error) {
        failed.current = true;
        report(source.poster && !posterFailed ? 'poster-only' : 'none');
        return;
      }
      // Autoplay denial is not an error state: the poster remains and every
      // control keeps working.
      report('autoplay-blocked');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused, src, reducedMotion]);

  const showVideo =
    Boolean(src) && !reducedMotion && state !== 'poster-only' && state !== 'none';
  const objectPosition = `${alignment.x} ${alignment.y}`;

  return (
    <>
      {/* Poster and video always occupy the identical rectangle and share one
          crop alignment; they are toggled with `hidden`, never unmounted, so a
          failure never collapses the media area. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="d-entrance__poster"
        src={source.poster ?? undefined}
        alt=""
        aria-hidden="true"
        hidden={!source.poster || posterFailed}
        onError={() => {
          // Poster also failed: plain black behind white UI.
          setPosterFailed(true);
          if (failed.current) report('none');
        }}
        style={{ objectPosition }}
      />

      {showVideo ? (
        <video
          className="d-entrance__video"
          ref={videoRef}
          aria-hidden="true"
          tabIndex={-1}
          muted
          playsInline
          loop={media.loop}
          preload="auto"
          poster={source.poster ?? undefined}
          src={src ?? undefined}
          onLoadedData={() => {
            report('ready');
            const video = videoRef.current;
            if (!video) return;
            // An entrance pause must not be overridden by a media-ready event.
            if (paused) video.pause();
            else void video.play().catch(() => report('autoplay-blocked'));
          }}
          onError={() => {
            failed.current = true;
            report(hasPoster ? 'poster-only' : 'none');
          }}
          style={{ objectPosition, opacity: state === 'ready' ? 1 : 0 }}
        />
      ) : (
        <video className="d-entrance__video" aria-hidden="true" tabIndex={-1} muted hidden />
      )}
    </>
  );
}
