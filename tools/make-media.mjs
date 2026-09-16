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
import { mkdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '..', 'public', 'media');

const TRIM_SECONDS = 18.0;
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

console.log(`encoding from ${source}${TRIM_SECONDS === null ? '' : ` (trimmed to ${TRIM_SECONDS}s)`}`);
for (const { file, scale, args } of encodes) {
  run([...trim, '-i', source, '-an', '-vf', `scale=${scale}:flags=lanczos`,
       ...args, '-pix_fmt', 'yuv420p', '-g', '60', join(OUT, file)]);
  report(file);
}

run(['-ss', String(POSTER_AT), '-i', source, '-frames:v', '1',
     '-vf', 'scale=1920:1080:flags=lanczos', '-q:v', '4',
     join(OUT, 'performance-poster.jpg')]);
report('performance-poster.jpg');
