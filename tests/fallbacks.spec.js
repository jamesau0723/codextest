/**
 * Failure states, persistence and routing (spec 7.7, 8, 9; acceptance 24–27, 40, 43).
 */
import { test, expect } from '@playwright/test';
import { openEntrance, expectCoversViewport, entranceUrl, exitEntrance, FIXTURE_MEDIA } from './helpers.js';

test('a media error shows the poster with every control working', async ({ page }) => {
  await openEntrance(page, {
    media: {
      master: {
        src: '/tests/fixtures/does-not-exist.webm',
        poster: '/tests/fixtures/landscape-16x9.png',
        width: 1280,
        height: 720
      }
    }
  });

  await expect(page.locator('.d-entrance[data-media="poster-only"]')).toBeVisible({ timeout: 6000 });
  expect(await page.locator('.d-entrance__poster').isVisible()).toBe(true);
  // The poster keeps the same edge-to-edge cover rectangle.
  await expectCoversViewport(page, '.d-entrance__poster');
  expect(await page.evaluate(
    () => getComputedStyle(document.querySelector('.d-entrance__poster')).objectFit
  )).toBe('cover');

  await expect(page.locator('.d-language__option')).toHaveCount(3);
  await exitEntrance(page);
  await expect(page.locator('.d-entrance')).toHaveCount(0, { timeout: 3000 });
});

test('video and poster both failing gives full-screen black with white UI', async ({ page }) => {
  await openEntrance(page, {
    media: {
      master: {
        src: '/tests/fixtures/does-not-exist.webm',
        poster: '/tests/fixtures/also-missing.png'
      }
    }
  });

  await expect(page.locator('.d-entrance[data-media="none"]')).toBeVisible({ timeout: 6000 });
  // Not a collapsed video area: the root still covers the viewport.
  await expectCoversViewport(page, '.d-entrance');
  await expectCoversViewport(page, '.d-entrance__scrim');

  const appearance = await page.evaluate(() => ({
    rootBackground: getComputedStyle(document.querySelector('.d-entrance')).backgroundColor,
    headingColour: getComputedStyle(document.querySelector('.d-scene__heading')).color,
    posterHidden: document.querySelector('.d-entrance__poster').hidden
  }));
  expect(appearance.rootBackground).toBe('rgb(0, 0, 0)');
  expect(appearance.headingColour).toBe('rgb(255, 255, 255)');
  expect(appearance.posterHidden).toBe(true);

  expect(await page.locator('.d-entrance__hint').count()).toBe(1);
});

test('an absent video configuration never hides the UI or blocks skipping', async ({ page }) => {
  await openEntrance(page, { media: { master: { src: null, poster: null } } });

  await expect(page.locator('.d-entrance[data-media="none"]')).toBeVisible();
  await expect(page.locator('.d-language__option')).toHaveCount(3);
  await expectCoversViewport(page, '.d-entrance');
  await exitEntrance(page);
  await expect(page.locator('.d-entrance')).toHaveCount(0, { timeout: 3000 });
});

test('the entrance renders before media is ready and never waits on it', async ({ page }) => {
  // Hold the video response open: the UI must not wait for it.
  await page.route('**/landscape-16x9.webm', async () => { /* never fulfilled */ });

  await page.addInitScript(() => { try { localStorage.clear(); } catch {} });
  await page.goto(entranceUrl(FIXTURE_MEDIA));

  await expect(page.locator('.d-language__option')).toHaveCount(3, { timeout: 4000 });
  expect(await page.locator('.d-entrance__hint').count()).toBe(1);
  await expectCoversViewport(page, '.d-entrance__scrim');
});

test('autoplay denial keeps the entrance usable', async ({ page }) => {
  await page.addInitScript(() => {
    // Simulate a browser refusing autoplay.
    const original = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function denied() {
      return Promise.reject(new DOMException('NotAllowedError', 'NotAllowedError'));
    };
    window.__originalPlay = original;
  });

  await openEntrance(page);
  await expect(page.locator('.d-entrance[data-media="autoplay-blocked"]')).toBeVisible({ timeout: 6000 });
  await expect(page.locator('.d-language__option')).toHaveCount(3);
  await exitEntrance(page);
  await expect(page.locator('.d-entrance')).toHaveCount(0, { timeout: 3000 });
});

test('the entrance works when storage is unavailable', async ({ page }) => {
  await page.addInitScript(() => {
    const throwing = {
      getItem() { throw new DOMException('SecurityError'); },
      setItem() { throw new DOMException('SecurityError'); },
      removeItem() { throw new DOMException('SecurityError'); }
    };
    Object.defineProperty(window, 'localStorage', { get: () => throwing, configurable: true });
  });

  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));

  await page.goto(entranceUrl(FIXTURE_MEDIA));
  await expect(page.locator('.d-language__option')).toHaveCount(3);
  await page.locator('.d-language__option[data-locale="en"]').click();
  await expect(page.locator('[data-scene="question1"]')).toBeVisible();
  await exitEntrance(page);
  await expect(page.locator('.d-entrance')).toHaveCount(0, { timeout: 3000 });

  expect(errors, `no uncaught errors: ${errors.join(' | ')}`).toHaveLength(0);
});

test('a returning visitor bypasses the entrance', async ({ page }) => {
  await openEntrance(page);
  await exitEntrance(page);
  await expect(page.locator('.d-entrance')).toHaveCount(0, { timeout: 3000 });

  await page.reload();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(400);
  expect(await page.locator('.d-entrance').count()).toBe(0);
  expect(await page.getAttribute('html', 'data-entrance')).toBe('skipped');
});

test('deep links open their target and never show the entrance', async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch {} });
  await page.goto('/programme.html#faculty');
  await page.waitForTimeout(400);

  expect(await page.locator('.d-entrance').count()).toBe(0);
  expect(page.url()).toContain('/programme.html#faculty');
  await expect(page.locator('#faculty')).toBeVisible();
});

test('Replay reopens the entrance without changing the saved outcome', async ({ page }) => {
  await openEntrance(page);
  await page.locator('.d-language__option[data-locale="zh-Hant"]').click();
  await page.locator('[data-action="advance"]').first().click();
  await page.locator('[data-scene="question2"] [data-action="advance"]').click();
  await page.locator('[data-scene="words"]').waitFor();
  await page.locator('[data-action="enter"]').click();
  await expect(page.locator('.d-entrance')).toHaveCount(0, { timeout: 3000 });
  expect(await page.evaluate(() => localStorage.getItem('dFestival.entranceOutcome'))).toBe('completed');

  const replay = page.locator('[data-action="replay-entrance"]');
  await expect(replay).toBeVisible();
  await replay.click();
  await expect(page.locator('.d-entrance')).toBeVisible();

  // Replay uses the saved language as provisional and still permits a choice.
  await expect(page.locator('.d-scene__heading')).toHaveText('選擇語言');
  await expect(page.locator('.d-language__option')).toHaveCount(3);
  // The saved outcome is untouched until a new exit is committed.
  expect(await page.evaluate(() => localStorage.getItem('dFestival.entranceOutcome'))).toBe('completed');

  // Exiting a replay returns focus to its launching control.
  await exitEntrance(page);
  await expect(page.locator('.d-entrance')).toHaveCount(0, { timeout: 3000 });
  expect(await page.evaluate(() => document.activeElement?.dataset.action)).toBe('replay-entrance');
  expect(await page.evaluate(() => localStorage.getItem('dFestival.entranceOutcome'))).toBe('skipped');
});

test('a supported URL locale takes priority over a stored language', async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.clear();
      localStorage.setItem('dFestival.locale', 'zh-Hans');
    } catch {}
  });
  await page.goto(entranceUrl(FIXTURE_MEDIA, 'lang=zh-Hant'));
  await expect(page.locator('.d-scene__heading')).toHaveText('選擇語言');
});

test('the homepage stays usable when the entrance script fails', async ({ page }) => {
  // Block the entrance module entirely — the site must still work.
  await page.route('**/src/site/main.js', (route) => route.abort());
  await page.goto('/index.html');
  await page.waitForLoadState('domcontentloaded');

  expect(await page.locator('.d-entrance').count()).toBe(0);
  await expect(page.locator('#main-content')).toBeVisible();
  await expect(page.locator('.site-header__brand')).toBeVisible();
  // Language links work without JavaScript.
  await expect(page.locator('.site-footer__langs a')).toHaveCount(3);
  // Nothing locked the page scroll.
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('');
});

test('with JavaScript disabled the site renders and the entrance does not', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('/index.html');

  expect(await page.locator('.d-entrance').count()).toBe(0);
  await expect(page.locator('#main-content')).toBeVisible();
  await expect(page.locator('.site-footer__langs a')).toHaveCount(3);
  await context.close();
});

test('font failure falls back to a readable serif without clipping', async ({ page }) => {
  // No webfonts are loaded by the entrance, so the display stack resolves to a
  // locally available serif. Assert it resolves and the text has real size.
  await openEntrance(page);
  const typography = await page.evaluate(() => {
    const heading = document.querySelector('.d-scene__heading');
    const rect = heading.getBoundingClientRect();
    return {
      family: getComputedStyle(heading).fontFamily,
      width: rect.width,
      height: rect.height,
      overflowing: heading.scrollWidth > heading.clientWidth + 1
    };
  });
  expect(typography.family).toContain('serif');
  expect(typography.height).toBeGreaterThan(10);
  expect(typography.width).toBeGreaterThan(10);
  expect(typography.overflowing).toBe(false);
});

test('dismissal cleans up listeners, timers and scroll state', async ({ page }) => {
  await openEntrance(page);
  await exitEntrance(page);
  await expect(page.locator('.d-entrance')).toHaveCount(0, { timeout: 3000 });

  const state = await page.evaluate(() => ({
    bodyOverflow: document.body.style.overflow,
    inert: document.getElementById('site-root').hasAttribute('inert'),
    ariaHidden: document.getElementById('site-root').getAttribute('aria-hidden'),
    entranceNodes: document.querySelectorAll('.d-entrance').length,
    probes: document.querySelectorAll('.d-word__probe').length
  }));

  expect(state.bodyOverflow).toBe('');
  expect(state.inert).toBe(false);
  expect(state.ariaHidden).toBeNull();
  expect(state.entranceNodes).toBe(0);
  expect(state.probes).toBe(0);

  // Escape after dismissal must not throw or re-trigger anything.
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  expect(errors).toHaveLength(0);
});

test('normal entry hands a playing video to the homepage without restarting it', async ({ page }) => {
  await openEntrance(page);
  await page.locator('.d-entrance[data-media="ready"]').waitFor();
  await page.locator('.d-language__option[data-locale="en"]').click();
  await page.locator('[data-scene="question1"] [data-action="advance"]').click();
  await page.locator('[data-scene="question2"] [data-action="advance"]').click();
  await page.locator('[data-scene="words"]').waitFor();
  await page.waitForTimeout(1200);

  const before = await page.evaluate(() => document.querySelector('.d-entrance__video').currentTime);
  expect(before).toBeGreaterThan(0.2);

  await page.locator('[data-action="enter"]').click();
  await expect(page.locator('.d-entrance')).toHaveCount(0, { timeout: 4000 });

  const after = await page.evaluate(() => {
    const video = document.querySelector('.site-hero video');
    return video ? { time: video.currentTime, paused: video.paused } : null;
  });

  expect(after, 'the homepage reused the entrance video element').not.toBeNull();
  // Reused, not recreated: the timeline continued rather than resetting.
  expect(after.time).toBeGreaterThanOrEqual(before);
  expect(after.paused).toBe(false);
});
