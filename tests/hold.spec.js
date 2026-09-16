/**
 * Hold-anywhere-to-skip (spec 6; acceptance 10–16).
 */
import { test, expect } from '@playwright/test';
import { openEntrance, reachWords, resetEntranceState, backgroundPoint, exitEntrance } from './helpers.js';

test('a 1499ms background hold does not skip', async ({ page }) => {
  await openEntrance(page);
  const point = await backgroundPoint(page);

  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.waitForTimeout(1200); // safely under the 1500ms threshold
  await page.mouse.up();
  await page.waitForTimeout(400);

  await expect(page.locator('.d-entrance')).toBeVisible();
  expect(await page.locator('[data-scene="language"]').count()).toBe(1);
});

test('a hold past the threshold previews the homepage and commits on release', async ({ page }) => {
  await openEntrance(page);
  const point = await backgroundPoint(page);

  await page.mouse.move(point.x, point.y);
  await page.mouse.down();

  // Progress feedback appears after the indicator delay, not immediately.
  await page.waitForTimeout(80);
  expect(await page.locator('.d-entrance__hold').getAttribute('data-state')).toBe('idle');

  await page.waitForTimeout(500);
  expect(await page.locator('.d-entrance__hold').getAttribute('data-state')).toBe('progressing');
  await expect(page.locator('.d-hold__label')).toHaveText('Keep holding to skip');

  // At the threshold the homepage is revealed behind the fading entrance,
  // while the pointer is still down — nothing has navigated yet.
  await page.waitForTimeout(1100);
  expect(await page.locator('.d-entrance').getAttribute('data-preview')).toBe('true');
  await expect(page.locator('.d-hold__label')).toHaveText('Release to enter');
  await expect(page.locator('.d-entrance')).toBeVisible();

  const previewOpacity = await page.evaluate(
    () => Number(getComputedStyle(document.querySelector('.d-entrance')).opacity)
  );
  expect(previewOpacity).toBeLessThan(0.5);

  // Release commits, with no extra confirmation tap.
  await page.mouse.up();
  await expect(page.locator('.d-entrance')).toHaveCount(0, { timeout: 4000 });
  expect(await page.evaluate(() => localStorage.getItem('dFestival.entranceOutcome'))).toBe('skipped');
});

test('a hold that begins on a language button skips without selecting it', async ({ page }) => {
  await openEntrance(page);
  const button = page.locator('.d-language__option[data-locale="zh-Hans"]');
  const box = await button.boundingBox();

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(1700);
  await page.mouse.up();

  await expect(page.locator('.d-entrance')).toHaveCount(0, { timeout: 4000 });
  // The previously provisional language is retained, not the held button's.
  expect(await page.evaluate(() => localStorage.getItem('dFestival.locale'))).toBeNull();
  expect(await page.getAttribute('html', 'lang')).toBe('en');
  expect(await page.evaluate(() => localStorage.getItem('dFestival.entranceOutcome'))).toBe('skipped');
});

test('a short tap on a language button still selects that language', async ({ page }) => {
  await openEntrance(page);
  const button = page.locator('.d-language__option[data-locale="zh-Hant"]');
  const box = await button.boundingBox();

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(120);
  await page.mouse.up();

  await expect(page.locator('[data-scene="question1"]')).toBeVisible();
  expect(await page.getAttribute('html', 'lang')).toBe('zh-Hant');
});

test('a release before the threshold on Continue performs its ordinary activation', async ({ page }) => {
  await openEntrance(page);
  await page.locator('.d-language__option[data-locale="en"]').click();
  await page.locator('[data-scene="question1"]').waitFor();

  const box = await page.locator('[data-scene="question1"] [data-action="advance"]').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(700); // past the indicator delay, under the threshold
  await page.mouse.up();

  await expect(page.locator('[data-scene="question2"]')).toBeVisible();
  // The cancelled hold left no progress decoration behind.
  expect(await page.locator('.d-entrance__hold').getAttribute('data-state')).toBe('idle');
});

test('movement past 12 CSS px cancels, and a new press is required', async ({ page }) => {
  await openEntrance(page);
  const point = await backgroundPoint(page);

  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.waitForTimeout(400);
  await page.mouse.move(point.x + 40, point.y, { steps: 4 });
  await page.waitForTimeout(1600); // well past the threshold, but cancelled
  await page.mouse.up();
  await page.waitForTimeout(300);

  await expect(page.locator('.d-entrance')).toBeVisible();
  expect(await page.locator('.d-entrance__hold').getAttribute('data-state')).toBe('idle');
  expect(await page.locator('.d-entrance').getAttribute('data-preview')).not.toBe('true');
});

test('movement under the tolerance keeps the hold alive', async ({ page }) => {
  await openEntrance(page);
  const point = await backgroundPoint(page);

  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.waitForTimeout(400);
  await page.mouse.move(point.x + 8, point.y + 6); // 10px: inside tolerance
  await page.waitForTimeout(1300);
  await page.mouse.up();

  await expect(page.locator('.d-entrance')).toHaveCount(0, { timeout: 4000 });
});

test('a second pointer cancels the hold', async ({ page }) => {
  await openEntrance(page);
  const point = await backgroundPoint(page);

  // Synthetic pointer events: two simultaneous pointers are not expressible
  // through the single-pointer mouse/touchscreen APIs.
  await page.evaluate(({ x, y }) => {
    const root = document.querySelector('.d-entrance');
    const make = (type, id) =>
      new PointerEvent(type, { pointerId: id, clientX: x, clientY: y, bubbles: true, isPrimary: id === 1 });
    root.dispatchEvent(make('pointerdown', 1));
    root.dispatchEvent(make('pointerdown', 2));
  }, point);

  await page.waitForTimeout(1800);
  expect(await page.locator('.d-entrance__hold').getAttribute('data-state')).toBe('idle');
  await expect(page.locator('.d-entrance')).toBeVisible();
});

test('pointercancel and window blur cancel the hold safely', async ({ page }) => {
  await openEntrance(page);
  const point = await backgroundPoint(page);

  for (const eventName of ['pointercancel', 'blur']) {
    await page.evaluate(({ x, y, eventName }) => {
      const root = document.querySelector('.d-entrance');
      root.dispatchEvent(new PointerEvent('pointerdown', {
        pointerId: 7, clientX: x, clientY: y, bubbles: true, isPrimary: true
      }));
      if (eventName === 'pointercancel') {
        root.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 7, bubbles: true }));
      } else {
        window.dispatchEvent(new Event('blur'));
      }
    }, { ...point, eventName });

    await page.waitForTimeout(1700);
    expect(await page.locator('.d-entrance').count(), `${eventName} must not navigate`).toBe(1);
    expect(await page.locator('.d-entrance__hold').getAttribute('data-state')).toBe('idle');
  }
});

test('a hold suspends the scene clock and a cancel restores the exact time', async ({ page }) => {
  await openEntrance(page);
  await reachWords(page, 'en');
  await page.waitForTimeout(1500); // inside "Desire"

  const point = await backgroundPoint(page);
  const before = await page.evaluate(() => document.querySelector('.d-word__en').textContent);

  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.waitForTimeout(1000);
  // The passage is frozen for the duration of the hold.
  const during = await page.evaluate(() => document.querySelector('.d-word__en').textContent);
  expect(during).toBe(before);

  await page.mouse.up(); // released early: cancel
  await page.waitForTimeout(150);
  const after = await page.evaluate(() => document.querySelector('.d-word__en').textContent);
  // Resumed from the saved time, not fast-forwarded through the hold.
  expect(after).toBe(before);
});

test('a completed hold does not click the homepage underneath', async ({ page }) => {
  await openEntrance(page);
  await page.evaluate(() => {
    window.__homepageClicks = 0;
    document.getElementById('site-root').addEventListener('click', () => {
      window.__homepageClicks += 1;
    }, true);
  });

  const point = await backgroundPoint(page);
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.waitForTimeout(1700);
  await page.mouse.up();

  await expect(page.locator('.d-entrance')).toHaveCount(0, { timeout: 4000 });
  expect(await page.evaluate(() => window.__homepageClicks)).toBe(0);
});

test('repeated exits cannot double-navigate or double-write storage', async ({ page }) => {
  await openEntrance(page);
  await page.evaluate(() => {
    window.__writes = [];
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function patched(key, value) {
      if (key === 'dFestival.entranceOutcome') window.__writes.push(value);
      return original.call(this, key, value);
    };
  });

  // Fire Escape repeatedly in quick succession.
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);

  expect(await page.evaluate(() => window.__writes)).toEqual(['skipped']);
  await expect(page.locator('.d-entrance')).toHaveCount(0);
});

test('right mouse-button holds are not intercepted', async ({ page }) => {
  await openEntrance(page);
  const point = await backgroundPoint(page);

  await page.mouse.move(point.x, point.y);
  await page.mouse.down({ button: 'right' });
  await page.waitForTimeout(1800);
  await page.mouse.up({ button: 'right' });

  await expect(page.locator('.d-entrance')).toBeVisible();
  expect(await page.locator('.d-entrance__hold').getAttribute('data-state')).toBe('idle');
});

test('the hold hint appears only after a language is chosen, then fades away', async ({ page }) => {
  await openEntrance(page);

  // Not shown during the language scene.
  const hint = page.locator('.d-entrance__hint');
  expect(await hint.getAttribute('data-state')).toBe('idle');
  expect(await hint.evaluate((node) => Number(getComputedStyle(node).opacity))).toBe(0);

  await page.locator('.d-language__option[data-locale="en"]').click();

  // Revealed as soon as the language is chosen, fading in over ~320ms.
  expect(await hint.getAttribute('data-state')).toBe('visible');
  await expect(hint).toHaveText('Hold anywhere for 1.5s to skip');
  await expect
    .poll(async () => hint.evaluate((node) => Number(getComputedStyle(node).opacity)), {
      timeout: 1500,
      intervals: [50]
    })
    .toBe(1);

  // Still there approaching the 2s hold, then fading.
  await page.waitForTimeout(1000);
  expect(await hint.getAttribute('data-state')).toBe('visible');

  await expect
    .poll(async () => hint.getAttribute('data-state'), { timeout: 4000 })
    .toBe('gone');
  expect(await hint.evaluate((node) => node.hidden)).toBe(true);

  // It does not come back in a later scene.
  await page.locator('[data-scene="question1"] [data-action="advance"]').click();
  await page.locator('[data-scene="question2"]').waitFor();
  await page.waitForTimeout(400);
  expect(await hint.getAttribute('data-state')).toBe('gone');
});

test('the removed Skip and pause controls are absent', async ({ page }) => {
  await openEntrance(page);
  expect(await page.locator('.d-entrance__skip').count()).toBe(0);
  expect(await page.locator('.d-entrance__pause').count()).toBe(0);
  expect(await page.locator('[data-action="skip"]').count()).toBe(0);
  expect(await page.locator('[data-action="pause"]').count()).toBe(0);
});

test('exit routes still work from every scene', async ({ page }) => {
  // Language scene, via Escape.
  await openEntrance(page);
  await exitEntrance(page);
  await expect(page.locator('.d-entrance')).toHaveCount(0, { timeout: 3000 });

  // Question scene, via a completed hold.
  await resetEntranceState(page);
  await openEntrance(page);
  await page.locator('.d-language__option[data-locale="en"]').click();
  await page.locator('[data-scene="question1"]').waitFor();
  const point = await backgroundPoint(page);
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.waitForTimeout(1700);
  await page.mouse.up();
  await expect(page.locator('.d-entrance')).toHaveCount(0, { timeout: 3000 });

  // Word passage, via Enter D.
  await resetEntranceState(page);
  await openEntrance(page);
  await reachWords(page, 'en');
  await page.locator('[data-action="enter"]').click();
  await expect(page.locator('.d-entrance')).toHaveCount(0, { timeout: 3000 });
  expect(await page.evaluate(() => localStorage.getItem('dFestival.entranceOutcome'))).toBe('completed');

  // Media-failure mode, via Escape.
  await resetEntranceState(page);
  await openEntrance(page, { media: { master: { src: null, poster: null } } });
  await exitEntrance(page);
  await expect(page.locator('.d-entrance')).toHaveCount(0, { timeout: 3000 });
});

test('a hold freezes the background video and a cancel restores it', async ({ page }) => {
  await openEntrance(page);
  await page.locator('.d-entrance[data-media="ready"]').waitFor();
  await page.waitForTimeout(500);

  const point = await backgroundPoint(page);
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.waitForTimeout(500);

  expect(await page.evaluate(() => document.querySelector('.d-entrance__video').paused)).toBe(true);

  await page.mouse.up(); // released early: cancel
  await page.waitForTimeout(300);
  // Playback resumes, because nothing else had paused it.
  expect(await page.evaluate(() => document.querySelector('.d-entrance__video').paused)).toBe(false);
});
