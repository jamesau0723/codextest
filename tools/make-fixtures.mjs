/**
 * Generates SYNTHETIC TEST FIXTURES ONLY.
 *
 * These are deliberately obvious test patterns — a grid, a true circle and
 * four distinct corner markers. They are NOT performance footage and must
 * never be shipped as production media. The circle makes non-uniform scaling
 * (distortion) visible at a glance; the corner markers make it obvious which
 * edges a cover crop has removed.
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '..', 'tests', 'fixtures');
mkdirSync(OUT, { recursive: true });

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i += 1) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

/** Draw the test pattern into an RGB buffer. */
function pattern(width, height) {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) * 0.4;
  const corners = [
    [255, 64, 64],   // top-left   red
    [64, 255, 96],   // top-right  green
    [96, 128, 255],  // bottom-left blue
    [255, 216, 64]   // bottom-right yellow
  ];
  const markerSize = Math.round(Math.min(width, height) * 0.12);

  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (width * 3 + 1);
    raw[rowStart] = 0; // filter: none
    for (let x = 0; x < width; x += 1) {
      const i = rowStart + 1 + x * 3;
      // Base checkerboard so any stretching shows as non-square cells.
      const cell = (Math.floor(x / 80) + Math.floor(y / 80)) % 2;
      let r = cell ? 44 : 28;
      let g = cell ? 44 : 28;
      let b = cell ? 52 : 34;

      // Grid lines every 80px.
      if (x % 80 === 0 || y % 80 === 0) { r = 92; g = 92; b = 104; }

      // A true circle: an ellipse here would mean the media was distorted.
      const dist = Math.hypot(x - cx, y - cy);
      if (Math.abs(dist - radius) < 4) { r = 255; g = 255; b = 255; }

      // Corner markers reveal which edges a cover crop removed.
      if (x < markerSize && y < markerSize) [r, g, b] = corners[0];
      else if (x >= width - markerSize && y < markerSize) [r, g, b] = corners[1];
      else if (x < markerSize && y >= height - markerSize) [r, g, b] = corners[2];
      else if (x >= width - markerSize && y >= height - markerSize) [r, g, b] = corners[3];

      raw[i] = r;
      raw[i + 1] = g;
      raw[i + 2] = b;
    }
  }
  return raw;
}

function writePng(path, width, height) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 2;  // colour type: truecolour
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(pattern(width, height), { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
  writeFileSync(path, png);
  console.log(`wrote ${path} (${width}x${height})`);
}

/**
 * Encode the fixture video with Chromium's own MediaRecorder.
 *
 * The ffmpeg bundled with Playwright is an encode-only build with no image
 * decoders, so it cannot turn the PNG pattern into a video. Chromium can, and
 * it produces exactly the VP8/WebM a browser will later play back.
 */
async function writeVideo(videoPath, width, height, seconds = 6) {
  const { chromium } = await import('@playwright/test');
  const { resolveChromium } = await import('./chromium-path.mjs');
  const browser = await chromium.launch({
    executablePath: resolveChromium(),
    args: ['--autoplay-policy=no-user-gesture-required']
  });
  const page = await browser.newPage();
  const base64 = await page.evaluate(
    async ({ width, height, seconds }) => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      const cx = width / 2;
      const cy = height / 2;
      const radius = Math.min(width, height) * 0.4;
      const marker = Math.round(Math.min(width, height) * 0.12);
      const corners = [
        ['#ff4040', 0, 0],
        ['#40ff60', width - marker, 0],
        ['#6080ff', 0, height - marker],
        ['#ffd840', width - marker, height - marker]
      ];

      const drawFrame = (t) => {
        ctx.fillStyle = '#1c1c22';
        ctx.fillRect(0, 0, width, height);
        // Checkerboard: stretched media would show non-square cells.
        ctx.fillStyle = '#2c2c34';
        for (let y = 0; y < height; y += 80) {
          for (let x = 0; x < width; x += 80) {
            if (((x / 80) + (y / 80)) % 2 === 0) ctx.fillRect(x, y, 80, 80);
          }
        }
        ctx.strokeStyle = '#5c5c68';
        ctx.lineWidth = 1;
        for (let x = 0; x <= width; x += 80) {
          ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
        }
        for (let y = 0; y <= height; y += 80) {
          ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
        }
        // A true circle. An ellipse here would mean the media was distorted.
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 6;
        ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.stroke();
        // Corner markers show which edges a cover crop removed.
        for (const [colour, x, y] of corners) {
          ctx.fillStyle = colour;
          ctx.fillRect(x, y, marker, marker);
        }
        // A sweeping bar, so a test can tell a playing video from a poster.
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.fillRect((t * 260) % width, 0, 36, height);
      };

      const stream = canvas.captureStream(25);
      const chunks = [];
      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8' });
      recorder.ondataavailable = (event) => chunks.push(event.data);
      const done = new Promise((resolve) => { recorder.onstop = resolve; });
      recorder.start();

      const started = performance.now();
      await new Promise((resolve) => {
        const loop = () => {
          const t = (performance.now() - started) / 1000;
          drawFrame(t);
          if (t >= seconds) resolve();
          else requestAnimationFrame(loop);
        };
        loop();
      });

      recorder.stop();
      await done;
      const blob = new Blob(chunks, { type: 'video/webm' });
      const buffer = await blob.arrayBuffer();
      let binary = '';
      const bytes = new Uint8Array(buffer);
      for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
      return btoa(binary);
    },
    { width, height, seconds }
  );
  await browser.close();
  writeFileSync(videoPath, Buffer.from(base64, 'base64'));
  console.log(`wrote ${videoPath} (${width}x${height})`);
}

const landscapePng = join(OUT, 'landscape-16x9.png');
const landscapeVideo = join(OUT, 'landscape-16x9.webm');
writePng(landscapePng, 1280, 720);
await writeVideo(landscapeVideo, 1280, 720);

const portraitPng = join(OUT, 'portrait-9x16.png');
const portraitVideo = join(OUT, 'portrait-9x16.webm');
writePng(portraitPng, 720, 1280);
await writeVideo(portraitVideo, 720, 1280);
