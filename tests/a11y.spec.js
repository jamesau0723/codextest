/**
 * Accessibility, motion and keyboard (spec 8; acceptance 17–21, 28).
 */
import { test, expect } from '@playwright/test';
import { openEntrance, reachWords, exitEntrance, revealState, FIXTURE_MEDIA } from './helpers.js';
import { decodePng, pixelAt, luminance } from './png.js';

test.describe('reduced motion', () => {
  test.use({ contextOptions: { reducedMotion: 'reduce' } });

  test('shows a still poster, full questions and a static ten-word list', async ({ page }) => {
    await openEntrance(page);
    await expect(page.locator('.d-entrance')).toHaveAttribute('data-reduced-motion', 'true');

    // No autoplaying video is fetched at all.
    const media = await page.evaluate(() => ({
      state: document.querySelector('.d-entrance').dataset.media,
      videoSrc: document.querySelector('.d-entrance__video').getAttribute('src'),
      posterVisible: !document.querySelector('.d-entrance__poster').hidden
    }));
    expect(media.videoSrc).toBeNull();
    expect(media.posterVisible).toBe(true);
    expect(media.state).toBe('reduced-still');

    await page.locator('.d-language__option[data-locale="zh-Hant"]').click();
    // The question is displayed in full immediately: no scrub track, no blur,
    // and no scrolling asked of the user.
    expect(await page.locator('.d-scroll-track').count()).toBe(0);
    expect(await page.locator('.d-scroll-cue').isVisible()).toBe(false);
    for (const word of await revealState(page)) {
      expect(word.opacity, `${word.text} fully visible`).toBe(1);
      expect(word.blur, `${word.text} unblurred`).toBe(0);
    }

    await page.locator('[data-scene="question1"] [data-action="advance"]').click();
    await page.locator('[data-scene="question2"]').waitFor();
    await page.locator('[data-scene="question2"] [data-action="advance"]').click();

    // The timed passage is replaced by all ten words at once.
    const list = page.locator('.d-static-words li');
    await expect(list).toHaveCount(10);
    await expect(list.first().locator('.d-static-words__en')).toHaveText('Doubt');
    await expect(list.first().locator('.d-static-words__zh')).toHaveText('質疑');
    await expect(list.last().locator('.d-static-words__en')).toHaveText('Dawn');

    // Enter D is immediately available.
    await expect(page.locator('[data-action="enter"]')).toBeEnabled();

    // The alternative scene can scroll on small or zoomed screens.
    await page.setViewportSize({ width: 360, height: 520 });
    expect(await page.evaluate(
      () => getComputedStyle(document.querySelector('.d-entrance__content')).overflowY
    )).toBe('auto');
  });

  test('hold feedback uses a static label instead of a filling ring', async ({ page }) => {
    await openEntrance(page);
    expect(await page.locator('.d-hold__ring').count()).toBe(0);

    const point = await page.evaluate(() => ({
      x: Math.round(window.innerWidth * 0.2),
      y: Math.round(window.innerHeight * 0.2)
    }));
    await page.mouse.move(point.x, point.y);
    await page.mouse.down();
    await page.waitForTimeout(600);
    await expect(page.locator('.d-hold__label')).toHaveText('Keep holding to skip');
    await page.waitForTimeout(1100);
    await expect(page.locator('.d-hold__label')).toHaveText('Release to enter');
    await page.mouse.up();
  });
});

test('Escape dismisses the entrance; keyboard needs no timed input', async ({ page }) => {
  await openEntrance(page);
  await page.keyboard.press('Escape');
  await expect(page.locator('.d-entrance')).toHaveCount(0, { timeout: 3000 });
  expect(await page.evaluate(() => localStorage.getItem('dFestival.entranceOutcome'))).toBe('skipped');
});

test('Escape yields to a higher-priority dialog', async ({ page }) => {
  await openEntrance(page);
  await page.evaluate(() => {
    const dialog = document.createElement('div');
    dialog.dataset.priorityDialog = 'true';
    document.body.appendChild(dialog);
  });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  await expect(page.locator('.d-entrance')).toBeVisible();
});

test('language and controls are operable by keyboard alone', async ({ page }) => {
  await openEntrance(page);

  // With Skip removed, the language options are the first actionable controls
  // in the entrance's focus order.
  const firstTabbable = await page.evaluate(() => {
    const selector = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';
    return document.querySelector('.d-entrance').querySelector(selector)?.dataset.locale;
  });
  expect(firstTabbable).toBe('zh-Hant');

  // Forward from the heading reaches the language options.
  await page.keyboard.press('Tab');
  const focused = await page.evaluate(() => document.activeElement?.dataset.locale);
  expect(['zh-Hant', 'zh-Hans', 'en']).toContain(focused);

  await page.keyboard.press('Enter');
  await expect(page.locator('[data-scene="question1"]')).toBeVisible();
});

test('focus is restricted to the entrance while it is open', async ({ page }) => {
  await openEntrance(page);
  expect(await page.evaluate(() => document.getElementById('site-root').hasAttribute('inert'))).toBe(true);
  expect(await page.getAttribute('#site-root', 'aria-hidden')).toBe('true');

  // Tabbing many times never lands outside the entrance.
  for (let i = 0; i < 14; i += 1) {
    await page.keyboard.press('Tab');
    const inside = await page.evaluate(() =>
      document.querySelector('.d-entrance').contains(document.activeElement)
    );
    expect(inside, `focus stayed inside on tab ${i + 1}`).toBe(true);
  }
});

test('focus moves to the homepage main content after entry', async ({ page }) => {
  await openEntrance(page);
  await exitEntrance(page);
  await expect(page.locator('.d-entrance')).toHaveCount(0, { timeout: 3000 });

  expect(await page.evaluate(() => document.activeElement?.id)).toBe('main-content');
  expect(await page.evaluate(() => document.getElementById('site-root').hasAttribute('inert'))).toBe(false);
  // Body scroll is restored.
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('');
});

test('each scene moves focus to its heading, and words do not steal focus', async ({ page }) => {
  await openEntrance(page);
  expect(await page.evaluate(() => document.activeElement?.className)).toContain('d-scene__heading');

  await page.locator('.d-language__option[data-locale="en"]').click();
  expect(await page.evaluate(() => document.activeElement?.className)).toContain('d-scene__question');
  // Focusing the heading must not scroll the scrub track away from the top.
  expect(await page.evaluate(
    () => document.querySelector('.d-entrance__content').scrollTop
  )).toBe(0);

  await page.locator('[data-scene="question1"] [data-action="advance"]').click();
  await page.locator('[data-scene="question2"]').waitFor();
  await page.locator('[data-scene="question2"] [data-action="advance"]').click();
  await page.locator('[data-scene="words"]').waitFor();

  // Focus is not reset on each timed word change.
  const first = await page.evaluate(() => document.activeElement?.dataset.scene || document.activeElement?.tagName);
  await page.waitForTimeout(2600);
  const later = await page.evaluate(() => document.activeElement?.dataset.scene || document.activeElement?.tagName);
  expect(later).toBe(first);
});

test('assistive technology gets whole questions and one stable word list', async ({ page }) => {
  await openEntrance(page);
  await page.locator('.d-language__option[data-locale="zh-Hans"]').click();

  // The per-grapheme layer is hidden from assistive technology; the complete
  // question is exposed once.
  const reveal = await page.evaluate(() => {
    const layer = document.querySelector('.d-reveal');
    const semantic = document.querySelector('.d-scene__question .sr-only');
    const cue = document.querySelector('.d-scroll-cue');
    return {
      hidden: layer.getAttribute('aria-hidden'),
      text: semantic.textContent,
      cueHidden: cue.getAttribute('aria-hidden')
    };
  });
  // The decorative per-word layer and the scroll affordance are both hidden
  // from assistive technology; the complete question is exposed once, in full,
  // regardless of scroll position.
  expect(reveal.hidden).toBe('true');
  expect(reveal.cueHidden).toBe('true');
  expect(reveal.text).toBe('上一次被音乐打动，是什么时候？');

  await page.locator('[data-scene="question1"] [data-action="advance"]').click();
  await page.locator('[data-scene="question2"]').waitFor();
  await page.locator('[data-scene="question2"] [data-action="advance"]').click();
  await page.locator('[data-scene="words"]').waitFor();

  const words = await page.evaluate(() => {
    const decorative = document.querySelector('.d-word');
    const live = document.querySelector('[data-scene="words"] [aria-live]');
    return {
      decorativeHidden: decorative.getAttribute('aria-hidden'),
      liveMode: live.getAttribute('aria-live'),
      items: Array.from(live.querySelectorAll('li')).map((li) => li.textContent.trim()),
      englishLangs: Array.from(live.querySelectorAll('li span[lang="en"]')).length
    };
  });

  expect(words.decorativeHidden).toBe('true');
  expect(words.liveMode).toBe('polite');
  expect(words.items).toHaveLength(10);
  expect(words.items[0]).toBe('Doubt 质疑');
  expect(words.items[9]).toBe('Dawn 曙光');
  // English words carry lang=en inside a Chinese page.
  expect(words.englishLangs).toBe(10);

  // The list is stable: it does not change as the animation advances.
  await page.waitForTimeout(2600);
  const later = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[data-scene="words"] [aria-live] li')).map((li) => li.textContent.trim())
  );
  expect(later).toEqual(words.items);
});

test('every control has a visible focus indicator and a 44px target', async ({ page }) => {
  await openEntrance(page);
  const controls = await page.evaluate(() => {
    const out = [];
    for (const node of document.querySelectorAll('.d-entrance button')) {
      node.focus();
      const style = getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      out.push({
        action: node.dataset.action || node.dataset.locale,
        outlineWidth: parseFloat(style.outlineWidth),
        outlineColor: style.outlineColor,
        width: rect.width,
        height: rect.height
      });
    }
    return out;
  });

  expect(controls.length).toBe(3); // three language options; Skip and pause removed
  for (const control of controls) {
    expect(control.height, `${control.action} height`).toBeGreaterThanOrEqual(44);
    expect(control.width, `${control.action} width`).toBeGreaterThanOrEqual(44);
    expect(control.outlineWidth, `${control.action} focus outline`).toBeGreaterThanOrEqual(2);
    expect(control.outlineColor).toBe('rgb(255, 255, 255)');
  }
});

test('white text keeps at least 4.5:1 against the composited brightest frame', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  // Worst case for a dark scrim: a pure white background frame.
  await openEntrance(page, {
    media: { master: { src: null, poster: '/tests/fixtures/white.png', width: 8, height: 8 } }
  });
  await page.waitForTimeout(400);

  const image = decodePng(await page.screenshot());
  // Sample the composited background well away from any text or control.
  const sample = pixelAt(image, Math.round(image.width * 0.06), Math.round(image.height * 0.34));
  const backgroundLuminance = relativeLuminance(sample);
  const contrast = (1.05) / (backgroundLuminance + 0.05); // white text is L = 1.0

  expect(contrast, `contrast against composited background rgb(${sample.r},${sample.g},${sample.b})`)
    .toBeGreaterThanOrEqual(4.5);
});

function relativeLuminance({ r, g, b }) {
  const channel = (value) => {
    const v = value / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

test('tab hidden freezes the timeline and does not fast-forward on return', async ({ page }) => {
  await openEntrance(page);
  await reachWords(page, 'en');
  await page.waitForTimeout(1500);

  const before = await page.evaluate(() => document.querySelector('.d-word__en').textContent);

  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForTimeout(1800);
  expect(await page.evaluate(() => document.querySelector('.d-word__en').textContent)).toBe(before);

  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForTimeout(120);
  // Resumes where it left off, rather than jumping ahead by the hidden time.
  expect(await page.evaluate(() => document.querySelector('.d-word__en').textContent)).toBe(before);
});
