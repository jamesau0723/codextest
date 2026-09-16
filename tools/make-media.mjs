/**
 * Encode the entrance background from the supplied performance master.
 *
 * The client's original is a 3840x2160 HEVC QuickTime, 21.1s, with audio. It is
 * not in the repository: pass its path as the first argument.
 *
 *   node tools/make-media.mjs /path/to/original.mov
 *
 * Neither the ffmpeg bundled with Playwright (no decoders at all) nor the
 * Chromium it ships (no proprietary codecs) can read HEVC, so this uses the
 * full ffmpeg from the `imageio-ffmpeg` PyPI package:
 *
 *   pip install imageio-ffmpeg
 *
 * ── THE TRIM IS AN APPROVED EDITORIAL DECISION ──────────────────────────────
 * TRIM_SECONDS stops just before a cross-dissolve at t≈18.15s into a 2.3s
 * close-up of the pianist. The close-up could not survive a full-viewport crop:
 * a phone in portrait shows only 26% of the source width and the face sits
 * right of centre, so the alignment the wide shot needs left almost nothing but
 * empty wall. The client approved the trim on 2026-09-16.
 *
 * Set TRIM_SECONDS to null to encode the whole clip instead.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '..', 'public', 'media');

const TRIM_SECONDS = 18.0;
/**
 * Crossfade applied at the loop point.
 *
 * The camera is locked off but the performers have moved between t=0 and the
 * trim, so a straight loop restarts with a visible jump. The output's opening
 * CROSSFADE_SECONDS blend the trim's tail into its head, which makes the last
 * frame and the first frame identical and the seam invisible.
 *
 * Set to 0 to loop with a hard cut instead.
 */
const CROSSFADE_SECONDS = 0.6;
/** Frame used for the poster; mid-loop, full ensemble visible. */
const POSTER_AT = 9;

const source = process.argv[2];
if (!source) {
  console.error('usage: node tools/make-media.mjs <path-to-original>');
  process.exit(1);
}

function ffmpeg() {
  try {
    return execFileSync('python3', ['-c', 'import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())'])
      .toString()
      .trim();
  } catch {
    console.error('Could not locate ffmpeg. Run: pip install imageio-ffmpeg');
    process.exit(1);
  }
}

const FF = ffmpeg();
mkdirSync(OUT, { recursive: true });

const trim = TRIM_SECONDS === null ? [] : ['-t', String(TRIM_SECONDS)];
const run = (args) => execFileSync(FF, ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: 'inherit' });

/**
 * Build the seamless loop.
 *
 * With source length T and crossfade D, the output is:
 *
 *   out[0 .. D]     xfade from source[T-D .. T] into source[0 .. D]
 *   out[D .. T-D]   source[D .. T-D] unchanged
 *
 * The output therefore opens on source[T-D] and closes on source[T-D], so the
 * loop point is continuous. Total length is T-D.
 *
 * Done once into an intermediate rather than inside each of the four encodes:
 * it decodes the 4K HEVC once instead of four times, and guarantees every
 * encode carries an identical loop.
 */
function buildLoopSource(target) {
  if (CROSSFADE_SECONDS <= 0 || TRIM_SECONDS === null) {
    run([...trim, '-i', source, '-an', '-vf', 'scale=1920:1080:flags=lanczos',
         '-c:v', 'libx264', '-preset', 'medium', '-crf', '14', '-pix_fmt', 'yuv420p',
         '-r', '30', target]);
    return;
  }
  const d = CROSSFADE_SECONDS;
  const tail = TRIM_SECONDS - d;
  const filter = [
    // Normalised to a constant 30fps first: the phone master is 30.03fps, and
    // the two halves of the seam have to pair frame for frame.
    '[0:v]scale=1920:1080:flags=lanczos,fps=30,split=3[a][b][c]',
    `[a]trim=start=0:end=${d},setpts=PTS-STARTPTS[head]`,
    `[b]trim=start=${tail}:end=${TRIM_SECONDS},setpts=PTS-STARTPTS[tailclip]`,
    `[c]trim=start=${d}:end=${tail},setpts=PTS-STARTPTS[body]`,
    // `blend` rather than `xfade`: trim+setpts drops the frame-rate metadata
    // that xfade insists on, and a straight linear mix is exactly what a loop
    // seam needs anyway. A fades out as B fades in across the D seconds.
    `[tailclip][head]blend=all_expr='A*(1-(T/${d}))+B*(T/${d})'[seam]`,
    // concat renegotiates the output rate and guesses 25fps if left alone,
    // which resamples the whole loop; pin it back to the source rate.
    '[seam][body]concat=n=2:v=1:a=0,fps=30[out]'
  ].join(';');

  run(['-t', String(TRIM_SECONDS), '-i', source, '-an',
       '-filter_complex', filter, '-map', '[out]',
       // Visually lossless intermediate, so the four real encodes below are not
       // stacking generation loss on top of the filter.
       '-c:v', 'libx264', '-preset', 'medium', '-crf', '14', '-pix_fmt', 'yuv420p',
       '-r', '30', target]);
}
const report = (file) => {
  const bytes = statSync(join(OUT, file)).size;
  console.log(`  ${file.padEnd(28)} ${(bytes / 1048576).toFixed(2)} MB`);
};

// `-an` throughout: the entrance is muted by design, so the audio track is
// dead weight in every encode.
const encodes = [
  { file: 'performance-master.mp4', scale: '1920:1080',
    args: ['-c:v', 'libx264', '-profile:v', 'high', '-preset', 'slow', '-crf', '24',
           '-maxrate', '2600k', '-bufsize', '5200k', '-movflags', '+faststart'] },
  { file: 'performance-compact.mp4', scale: '1280:720',
    args: ['-c:v', 'libx264', '-profile:v', 'high', '-preset', 'slow', '-crf', '26',
           '-maxrate', '1250k', '-bufsize', '2500k', '-movflags', '+faststart'] },
  { file: 'performance-master.webm', scale: '1920:1080',
    args: ['-c:v', 'libvpx-vp9', '-crf', '36', '-b:v', '0', '-deadline', 'good',
           '-cpu-used', '4', '-row-mt', '1'] },
  { file: 'performance-compact.webm', scale: '1280:720',
    args: ['-c:v', 'libvpx-vp9', '-crf', '40', '-b:v', '0', '-deadline', 'good',
           '-cpu-used', '4', '-row-mt', '1'] }
];

console.log(
  `encoding from ${source}` +
    `${TRIM_SECONDS === null ? '' : ` (trimmed to ${TRIM_SECONDS}s`}` +
    `${CROSSFADE_SECONDS > 0 ? `, ${CROSSFADE_SECONDS}s loop crossfade` : ''})`
);

const loopSource = join(tmpdir(), `d-festival-loop-${process.pid}.mp4`);
buildLoopSource(loopSource);

try {
  for (const { file, scale, args } of encodes) {
    run(['-i', loopSource, '-an', '-vf', `scale=${scale}:flags=lanczos`,
         ...args, '-pix_fmt', 'yuv420p', '-r', '30', '-g', '60', join(OUT, file)]);
    report(file);
  }

  // The poster comes from the ORIGINAL, not the looped intermediate: its
  // timestamps have shifted by the crossfade, and the poster should be a clean
  // frame rather than one inside a blend.
  run(['-ss', String(POSTER_AT), '-i', source, '-frames:v', '1',
       '-vf', 'scale=1920:1080:flags=lanczos', '-q:v', '4',
       join(OUT, 'performance-poster.jpg')]);
  report('performance-poster.jpg');
} finally {
  rmSync(loopSource, { force: true });
}
