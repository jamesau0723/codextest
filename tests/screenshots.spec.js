/**
 * Screenshot evidence for the handoff (acceptance 39, 44).
 *
 * IMPORTANT: every frame captured here uses a SYNTHETIC TEST PATTERN, not the
 * D Festival performance recording, which has not been supplied. These images
 * prove layout, cover geometry, centring and state — they are NOT evidence
 * that the final crop composition is right for the real footage.
 */
import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { openEntrance, reachWords, scrubTo } from './helpers.js';

const OUT = 'docs/screenshots';
mkdirSync(OUT, { recursive: true });

// The spec asks for these three captures at minimum.
const CAPTURE_SIZES = [
  { name: '390x844-phone', width: 390, height: 844 },
  { name: '820x1180-tablet', width: 820, height: 1180 },
  { name: '1440x900-desktop', width: 1440, height: 900 }
];

for (const size of CAPTURE_SIZES) {
  test(`capture the sequence at ${size.name}`, async ({ page }) => {
    await page.setViewportSize({ width: size.width, height: size.height });
    await openEntrance(page);
    await page.locator('.d-entrance[data-media="ready"]').waitFor();
    await page.waitForTimeout(250);

    // Scene 1: language choice, all three options.
    await page.screenshot({ path: `${OUT}/${size.name}-1-language.png` });

    // Question 1, captured at three points along the scroll scrub.
    await page.locator('.d-language__option[data-locale="en"]').click();
    await page.locator('[data-scene="question1"]').waitFor();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT}/${size.name}-2-question1-unrevealed.png` });
    await scrubTo(page, 0.45);
    await page.screenshot({ path: `${OUT}/${size.name}-3-question1-scrubbing.png` });
    await scrubTo(page, 1);
    await page.screenshot({ path: `${OUT}/${size.name}-4-question1-revealed.png` });

    await page.locator('[data-scene="question1"] [data-action="advance"]').click();
    await page.locator('[data-scene="question2"]').waitFor();
    await scrubTo(page, 0.5);
    await page.screenshot({ path: `${OUT}/${size.name}-5-question2-scrubbing.png` });

    await page.locator('[data-scene="question2"] [data-action="advance"]').click();
    await page.locator('[data-scene="words"]').waitFor();

    // The longest word, captured on a settled frame rather than mid-reveal.
    await waitForSettledWord(page, 'Discernment');
    await page.screenshot({ path: `${OUT}/${size.name}-6-longest-word.png` });

    // Final D.
    await page.locator('[data-scene="final"]').waitFor({ timeout: 12_000 });
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${OUT}/${size.name}-7-final-d.png` });
  });
}

test('capture Chinese scenes at 390x844', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openEntrance(page);
  await page.locator('.d-entrance[data-media="ready"]').waitFor();
  await page.locator('.d-language__option[data-locale="zh-Hant"]').click();
  await page.locator('[data-scene="question1"]').waitFor();
  await scrubTo(page, 0.45);
  await page.screenshot({ path: `${OUT}/390x844-zh-Hant-question1-scrubbing.png` });

  await reachWordsFromQuestion1(page);
  await waitForSettledWord(page, 'Discernment');
  await page.screenshot({ path: `${OUT}/390x844-zh-Hant-word-with-translation.png` });
});

test('capture Simplified Chinese word pairing at 1440x900', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openEntrance(page);
  await page.locator('.d-entrance[data-media="ready"]').waitFor();
  await reachWords(page, 'zh-Hans');
  await waitForSettledWord(page, 'Discernment');
  await page.screenshot({ path: `${OUT}/1440x900-zh-Hans-word-with-translation.png` });
});

test('capture a portrait-to-landscape rotation without restarting', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openEntrance(page);
  await page.locator('.d-entrance[data-media="ready"]').waitFor();
  await reachWords(page, 'en');
  await page.waitForTimeout(2600);
  await page.screenshot({ path: `${OUT}/rotation-1-portrait-390x844.png` });

  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${OUT}/rotation-2-landscape-844x390.png` });
});

test('capture the crop previews per viewport shape', async ({ page }) => {
  // Crop previews with the scrim removed, so the actual cover crop is visible
  // for editorial review. Synthetic pattern, not the real footage.
  for (const shape of [
    { name: 'narrow-390x844', width: 390, height: 844 },
    { name: 'balanced-820x1180', width: 820, height: 1180 },
    { name: 'wide-1440x900', width: 1440, height: 900 },
    { name: 'ultrawide-3440x1440', width: 3440, height: 1440 }
  ]) {
    await page.setViewportSize({ width: shape.width, height: shape.height });
    await openEntrance(page);
    await page.locator('.d-entrance[data-media="ready"]').waitFor();
    await page.addStyleTag({
      content: '.d-entrance__scrim,.d-entrance__ui{opacity:0 !important}'
    });
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${OUT}/crop-preview-${shape.name}.png` });
  }
});

test('capture the media-failure and reduced-motion states', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openEntrance(page, { media: { master: { src: null, poster: null } } });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/fallback-no-media-390x844.png` });
});

test.describe('reduced motion capture', () => {
  test.use({ contextOptions: { reducedMotion: 'reduce' } });

  test('capture the static ten-word list', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openEntrance(page);
    await page.locator('.d-language__option[data-locale="zh-Hant"]').click();
    await page.locator('[data-scene="question1"] [data-action="advance"]').click();
    await page.locator('[data-scene="question2"] [data-action="advance"]').click();
    await page.locator('.d-static-words').waitFor();
    await page.waitForTimeout(250);
    await page.screenshot({ path: `${OUT}/reduced-motion-static-words-1440x900.png` });
  });
});

test('capture the hold-to-skip progress and threshold preview', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openEntrance(page);
  await page.locator('.d-entrance[data-media="ready"]').waitFor();

  const point = { x: 90, y: 200 };
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/hold-1-progress-390x844.png` });

  await page.waitForTimeout(900);
  await page.screenshot({ path: `${OUT}/hold-2-threshold-preview-390x844.png` });
  await page.mouse.up();
});

/**
 * Wait for a specific word to be showing at full opacity with its glow settled,
 * so a capture is never taken mid-reveal or mid-fade.
 */
async function waitForSettledWord(page, word) {
  await expect
    .poll(
      async () =>
        page.evaluate(() => {
          const en = document.querySelector('.d-word__en');
          const group = document.querySelector('.d-word');
          if (!en || !group) return null;
          return `${en.textContent}|${Number(getComputedStyle(group).opacity) >= 0.99}`;
        }),
      { timeout: 14_000, intervals: [50] }
    )
    .toBe(`${word}|true`);
}

async function reachWordsFromQuestion1(page) {
  await page.locator('[data-scene="question1"] [data-action="advance"]').click();
  await page.locator('[data-scene="question2"]').waitFor();
  await page.locator('[data-scene="question2"] [data-action="advance"]').click();
  await page.locator('[data-scene="words"]').waitFor();
}
