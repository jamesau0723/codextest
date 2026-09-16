/**
 * Scene content, order and timing (spec 2, 3; acceptance 1–9, 27).
 */
import { test, expect } from '@playwright/test';
import { openEntrance, reachWords } from './helpers.js';

const WORDS = ['Doubt', 'Desire', 'Discipline', 'Devotion', 'Dialogue',
               'Daring', 'Discernment', 'Discovery', 'Depth', 'Dawn'];

const TRADITIONAL = ['質疑', '渴望', '自律', '傾心', '對話', '膽識', '洞察', '發現', '深邃', '曙光'];
const SIMPLIFIED  = ['质疑', '渴望', '自律', '倾心', '对话', '胆识', '洞察', '发现', '深邃', '曙光'];

test('the first scene offers all three languages with no preselected bias', async ({ page }) => {
  await openEntrance(page);
  const options = page.locator('.d-language__option');
  await expect(options).toHaveCount(3);
  await expect(options.nth(0)).toHaveText('繁體中文');
  await expect(options.nth(1)).toHaveText('简体中文');
  await expect(options.nth(2)).toHaveText('English');

  // No option carries default visual weight or a selected state.
  const bias = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.d-language__option')).map((node) => ({
      pressed: node.getAttribute('aria-pressed'),
      current: node.getAttribute('aria-current'),
      classes: node.className,
      weight: getComputedStyle(node).fontWeight,
      border: getComputedStyle(node).borderColor,
      background: getComputedStyle(node).backgroundColor
    }))
  );
  expect(new Set(bias.map((b) => b.weight)).size).toBe(1);
  expect(new Set(bias.map((b) => b.border)).size).toBe(1);
  expect(new Set(bias.map((b) => b.background)).size).toBe(1);
  for (const option of bias) {
    expect(option.pressed).toBeNull();
    expect(option.current).toBeNull();
  }
});

test('language choice changes entrance copy and website content', async ({ page }) => {
  await openEntrance(page);
  await page.locator('.d-language__option[data-locale="zh-Hant"]').click();

  await expect(page.locator('[data-scene="question1"] .sr-only').first())
    .toHaveText('上一次被音樂打動，是甚麼時候？');
  await expect(page.locator('[data-scene="question1"] [data-action="advance"]')).toHaveText('繼續');
  await expect(page.locator('.d-entrance__skip')).toHaveText('略過');
  await expect(page.locator('.d-entrance__hint')).toHaveText('長按任意位置 1.5 秒即可略過');

  // The website underneath, not just the entrance labels.
  expect(await page.getAttribute('html', 'lang')).toBe('zh-Hant');
  await expect(page.locator('.site-hero__lede')).toHaveText('青年鋼琴家藝術節');
  // The locale is reflected in the route.
  expect(page.url()).toContain('lang=zh-Hant');
});

test('exactly two questions appear in order, with no answer form', async ({ page }) => {
  await openEntrance(page);
  await page.locator('.d-language__option[data-locale="en"]').click();

  await expect(page.locator('[data-scene="question1"] .sr-only').first())
    .toHaveText('When did music last move you?');
  expect(await page.locator('input, textarea, form').count()).toBe(0);

  await page.locator('[data-scene="question1"] [data-action="advance"]').click();
  await expect(page.locator('[data-scene="question2"] .sr-only').first())
    .toHaveText('What turns notes into music?');
  expect(await page.locator('input, textarea, form').count()).toBe(0);

  await page.locator('[data-scene="question2"] [data-action="advance"]').click();
  await page.locator('[data-scene="words"]').waitFor();
  // The question and its button are gone before the word passage.
  await page.waitForTimeout(300);
  expect(await page.locator('.d-scene__question').count()).toBe(0);
});

test('questions are user-paced: no automatic advancement', async ({ page }) => {
  await openEntrance(page);
  await page.locator('.d-language__option[data-locale="en"]').click();
  await page.locator('[data-scene="question1"]').waitFor();
  // Well past the 1000ms typing duration.
  await page.waitForTimeout(4000);
  await expect(page.locator('[data-scene="question1"]')).toBeVisible();
  expect(await page.locator('[data-scene="question2"]').count()).toBe(0);
});

test('Continue works while the question is still typing, in one tap', async ({ page }) => {
  await openEntrance(page);
  await page.locator('.d-language__option[data-locale="en"]').click();
  await page.locator('[data-scene="question1"]').waitFor();

  // Click immediately — typing has not finished.
  const stillTyping = await page.evaluate(
    () => document.querySelectorAll('.d-type__g:not(.is-shown)').length > 0
  );
  expect(stillTyping).toBe(true);

  await page.locator('[data-scene="question1"] [data-action="advance"]').click();
  await expect(page.locator('[data-scene="question2"]')).toBeVisible();
});

test('short taps on the empty background do nothing', async ({ page }) => {
  await openEntrance(page);
  await page.locator('.d-language__option[data-locale="en"]').click();
  await page.locator('[data-scene="question1"]').waitFor();

  const box = page.viewportSize();
  await page.mouse.click(box.width - 60, box.height / 2 - 200);
  await page.waitForTimeout(300);
  await expect(page.locator('[data-scene="question1"]')).toBeVisible();
  expect(await page.locator('[data-scene="question2"]').count()).toBe(0);
});

test('typing reveals by grapheme and the caret disappears when complete', async ({ page }) => {
  await openEntrance(page);
  await page.locator('.d-language__option[data-locale="zh-Hant"]').click();
  await page.locator('[data-scene="question1"]').waitFor();

  const total = await page.locator('.d-type__g').count();
  // 「上一次被音樂打動，是甚麼時候？」 is 15 graphemes.
  expect(total).toBe(15);

  await page.waitForTimeout(1400);
  expect(await page.locator('.d-type__g.is-shown').count()).toBe(total);
  expect(await page.locator('.d-type__g.has-caret').count()).toBe(0);
});

test('the ten words appear once, in order, with the right spelling', async ({ page }) => {
  await openEntrance(page);
  await reachWords(page, 'en');

  const seen = [];
  const deadline = Date.now() + 16_000;
  while (Date.now() < deadline) {
    const text = await page.evaluate(() => document.querySelector('.d-word__en')?.textContent || '');
    if (text && seen[seen.length - 1] !== text) seen.push(text);
    if (seen.length === WORDS.length && await page.locator('[data-scene="final"]').count()) break;
    await page.waitForTimeout(90);
  }

  expect(seen).toEqual(WORDS);
  // English only in English mode.
  expect(await page.evaluate(() => document.querySelector('.d-word__zh')?.textContent || '')).toBe('');
});

for (const [locale, translations] of [['zh-Hant', TRADITIONAL], ['zh-Hans', SIMPLIFIED]]) {
  test(`${locale} keeps the English words and adds the correct script`, async ({ page }) => {
    await openEntrance(page);
    await reachWords(page, locale);

    const pairs = [];
    const deadline = Date.now() + 16_000;
    while (Date.now() < deadline) {
      const sample = await page.evaluate(() => {
        const en = document.querySelector('.d-word__en');
        const zh = document.querySelector('.d-word__zh');
        return en?.textContent ? { en: en.textContent, zh: zh?.textContent || '', lang: en.lang } : null;
      });
      if (sample && pairs[pairs.length - 1]?.en !== sample.en) pairs.push(sample);
      if (pairs.length === 10) break;
      await page.waitForTimeout(90);
    }

    expect(pairs.map((p) => p.en)).toEqual(WORDS);
    expect(pairs.map((p) => p.zh)).toEqual(translations);
    // English words are marked lang=en inside a Chinese page.
    expect(new Set(pairs.map((p) => p.lang))).toEqual(new Set(['en']));
  });
}

test('Dawn becomes D and D FESTIVAL, and the passage does not repeat', async ({ page }) => {
  await openEntrance(page);
  await reachWords(page, 'en');

  await page.locator('[data-scene="final"]').waitFor({ timeout: 20_000 });
  await page.waitForTimeout(900);

  const final = await page.evaluate(() => {
    const d = document.querySelector('.d-final__d');
    const awn = document.querySelector('.d-final__awn');
    const festival = document.querySelector('.d-final__festival');
    return {
      d: d.textContent,
      awn: awn.textContent,
      awnOpacity: Number(getComputedStyle(awn).opacity),
      festival: festival.textContent,
      festivalOpacity: Number(getComputedStyle(festival).opacity),
      enterVisible: Boolean(document.querySelector('[data-action="enter"]'))
    };
  });

  expect(final.d).toBe('D');
  expect(final.awn).toBe('awn');
  expect(final.awnOpacity).toBeLessThan(0.02);
  expect(final.festival).toBe('D FESTIVAL');
  expect(final.festivalOpacity).toBeGreaterThan(0.98);
  expect(final.enterVisible).toBe(true);

  // The final composition waits without a time limit and never restarts.
  await page.waitForTimeout(3000);
  await expect(page.locator('[data-scene="final"]')).toBeVisible();
  expect(await page.locator('[data-scene="words"]').count()).toBe(0);

  // The D is horizontally centred once `awn` has dissolved.
  const offset = await page.evaluate(() => {
    const rect = document.querySelector('.d-final__d').getBoundingClientRect();
    return Math.abs((rect.left + rect.right) / 2 - window.innerWidth / 2);
  });
  expect(offset).toBeLessThanOrEqual(2);
});

test('Enter D is available from the start of the word passage', async ({ page }) => {
  await openEntrance(page);
  await reachWords(page, 'en');
  const enter = page.locator('[data-action="enter"]');
  await expect(enter).toBeVisible();
  await expect(enter).toBeEnabled();
  await expect(enter).toHaveText('Enter D');
});

test('the excluded decorations are absent', async ({ page }) => {
  await openEntrance(page);
  const markup = await page.locator('.d-entrance').innerHTML();
  for (const banned of ['moon', 'portal', 'particle', 'registration', 'onboarding']) {
    expect(markup.toLowerCase()).not.toContain(banned);
  }
  // No gold styling anywhere in the entrance.
  const colours = await page.evaluate(() => {
    const out = [];
    for (const node of document.querySelectorAll('.d-entrance, .d-entrance *')) {
      const style = getComputedStyle(node);
      out.push(style.color, style.borderColor, style.backgroundColor, style.boxShadow);
    }
    return out.join(' ');
  });
  // Gold tones would show as a high red/green, low blue triple.
  const goldish = /rgba?\((2[0-5]\d|1[6-9]\d),\s*(1[5-9]\d|2[0-1]\d),\s*([0-9]|[1-9]\d)[,)]/;
  expect(colours).not.toMatch(goldish);
});

test('the scrim covers the viewport and text is not dimmed with it', async ({ page }) => {
  await openEntrance(page);
  const layers = await page.evaluate(() => {
    const scrim = document.querySelector('.d-entrance__scrim');
    const ui = document.querySelector('.d-entrance__ui');
    const root = document.querySelector('.d-entrance');
    return {
      scrimBackground: getComputedStyle(scrim).backgroundColor,
      scrimIsAncestorOfUi: scrim.contains(ui),
      rootOpacity: getComputedStyle(root).opacity,
      uiOpacity: getComputedStyle(ui).opacity
    };
  });
  // The scrim is a sibling of the content, never its parent.
  expect(layers.scrimIsAncestorOfUi).toBe(false);
  expect(layers.scrimBackground).toBe('rgba(0, 0, 0, 0.6)');
  // No opacity applied to a common parent of both text and overlay.
  expect(Number(layers.rootOpacity)).toBe(1);
  expect(Number(layers.uiOpacity)).toBe(1);
});
