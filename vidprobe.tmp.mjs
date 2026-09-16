import { chromium } from '@playwright/test';
import { resolveChromium } from './tools/chromium-path.mjs';
const b = await chromium.launch({ executablePath: resolveChromium(), args:['--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage({ viewport: { width: 900, height: 1400 } });
await p.goto('http://127.0.0.1:4173/vid/rec.mp4'.replace('/vid/','/uploads/'));
const info = await p.evaluate(async () => {
  const v = document.querySelector('video');
  if (!v) return { error: 'no video element' };
  await new Promise(r => { if (v.readyState >= 1) r(); else { v.onloadedmetadata = r; v.onerror = () => r(); } });
  return { w: v.videoWidth, h: v.videoHeight, dur: v.duration, err: v.error ? v.error.code + ':' + v.error.message : null };
});
console.log('INFO', JSON.stringify(info));
await b.close();
