import { expect } from '@playwright/test';

/** Fixture media, passed through the documented test seam. */
export const FIXTURE_MEDIA = {
  master: {
    src: '/tests/fixtures/landscape-16x9.webm',
    type: 'video/webm',
    poster: '/tests/fixtures/landscape-16x9.png',
    width: 1280,
    height: 720
  }
};

export const NO_MEDIA = { master: { src: null, poster: null } };

export function entranceUrl(media = FIXTURE_MEDIA, extra = '') {
  const query = media === null ? '' : `media=${encodeURIComponent(JSON.stringify(media))}`;
  const parts = [query, extra].filter(Boolean).join('&');
  return `/index.html${parts ? `?${parts}` : ''}`;
}

/**
 * Reset the saved entrance state so the next navigation auto-shows again.
 * Needed by tests that open the entrance several times in one tab.
 */
export async function resetEntranceState(page) {
  await page
    .evaluate(() => {
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch {
        /* storage may be unavailable */
      }
    })
    .catch(() => { /* nothing loaded yet */ });
}

/** Open the homepage with a clean storage state so the entrance auto-shows. */
export async function openEntrance(page, { media = FIXTURE_MEDIA, extra = '' } = {}) {
  await page.addInitScript(() => {
    // Clear once per tab, not on every navigation: a reload must still look
    // like a returning visit.
    try {
      if (!sessionStorage.getItem('__dfestival_test_cleared')) {
        localStorage.clear();
        sessionStorage.setItem('__dfestival_test_cleared', '1');
      }
    } catch {
      /* storage may be unavailable; the entrance must still work */
    }
  });
  await page.goto(entranceUrl(media, extra));
  await page.locator('.d-entrance').waitFor({ state: 'visible' });
  return page.locator('.d-entrance');
}

/** Advance from the language scene into the word passage. */
export async function reachWords(page, locale = 'en') {
  await page.locator(`.d-language__option[data-locale="${locale}"]`).click();
  await page.locator('[data-scene="question1"]').waitFor();
  await page.locator('[data-scene="question1"] [data-action="advance"]').click();
  await page.locator('[data-scene="question2"]').waitFor();
  await page.locator('[data-scene="question2"] [data-action="advance"]').click();
  await page.locator('[data-scene="words"]').waitFor();
}

/**
 * Assert that an element covers the browser viewport rectangle within 1 CSS px.
 */
export async function expectCoversViewport(page, selector) {
  const result = await page.evaluate((sel) => {
    const node = document.querySelector(sel);
    if (!node) return { missing: true };
    const rect = node.getBoundingClientRect();
    return {
      top: rect.top,
      left: rect.left,
      right: rect.right,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight
    };
  }, selector);

  expect(result.missing, `${selector} should exist`).toBeFalsy();
  expect(Math.abs(result.left), `${selector} left edge`).toBeLessThanOrEqual(1);
  expect(Math.abs(result.top), `${selector} top edge`).toBeLessThanOrEqual(1);
  expect(
    Math.abs(result.width - result.viewportWidth),
    `${selector} width vs viewport`
  ).toBeLessThanOrEqual(1);
  expect(
    Math.abs(result.height - result.viewportHeight),
    `${selector} height vs viewport`
  ).toBeLessThanOrEqual(1);
  return result;
}

/** Perform a hold gesture of a given duration at a point. */
export async function hold(page, { x, y, ms, steps = 0 }) {
  await page.mouse.move(x, y);
  await page.mouse.down();
  if (steps > 0) await page.mouse.move(x + steps, y);
  await page.waitForTimeout(ms);
  await page.mouse.up();
}
