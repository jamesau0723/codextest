/**
 * Scene content, order and timing (spec 2, 3; acceptance 1–9, 27).
 */
import { test, expect } from '@playwright/test';
import { openEntrance, reachWords, scrubTo, revealState } from './helpers.js';

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
  await expect(page.locator('.d-entrance__hint')).toHaveText('長按任意位置 1.5 秒即可略過');
  await expect(page.locator('.d-scroll-cue')).toHaveText('向下捲動閱讀');

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
  await page.waitForTimeout(4000);
  await expect(page.locator('[data-scene="question1"]')).toBeVisible();
  expect(await page.locator('[data-scene="question2"]').count()).toBe(0);

  // A fully scrubbed reveal still does not advance on its own.
  await scrubTo(page, 1);
  await page.waitForTimeout(800);
  await expect(page.locator('[data-scene="question1"]')).toBeVisible();
  expect(await page.locator('[data-scene="question2"]').count()).toBe(0);
});

test('Continue works at any scroll position, in one tap', async ({ page }) => {
  await openEntrance(page);
  await page.locator('.d-language__option[data-locale="en"]').click();
  await page.locator('[data-scene="question1"]').waitFor();

  // Click immediately — the reveal has not been scrubbed at all, so the reveal
  // is never a gate on advancing.
  const unrevealed = await page.evaluate(
    () => Number(getComputedStyle(document.querySelector('.d-reveal__w')).opacity)
  );
  expect(unrevealed).toBeCloseTo(0.2, 2);

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

test('the question reveals word-by-word, scrubbed by scroll position', async ({ page }) => {
  await openEntrance(page);
  await page.locator('.d-language__option[data-locale="en"]').click();
  await page.locator('[data-scene="question1"]').waitFor();

  // Unrevealed state: every word starts at opacity 0.2 and blur(4px).
  const initial = await revealState(page);
  expect(initial.map((word) => word.text)).toEqual(['When', 'did', 'music', 'last', 'move', 'you?']);
  for (const word of initial) {
    expect(word.opacity, `${word.text} starts faded`).toBeCloseTo(0.2, 2);
    expect(word.blur, `${word.text} starts blurred`).toBeCloseTo(4, 1);
  }

  // Nothing is time-driven: waiting changes nothing at all.
  await page.waitForTimeout(1600);
  expect(await revealState(page)).toEqual(initial);

  // Part-way through the scrub the reveal is a monotonic cascade: earlier words
  // are never less revealed than later ones.
  await scrubTo(page, 0.45);
  const mid = await revealState(page);
  for (let i = 1; i < mid.length; i += 1) {
    expect(mid[i - 1].opacity, `word ${i - 1} leads word ${i}`).toBeGreaterThanOrEqual(mid[i].opacity - 0.001);
    expect(mid[i - 1].blur, `word ${i - 1} clearer than word ${i}`).toBeLessThanOrEqual(mid[i].blur + 0.001);
  }
  expect(mid[0].opacity).toBeGreaterThan(initial[0].opacity);
  expect(mid[mid.length - 1].opacity).toBeLessThan(1);

  // Fully scrubbed: every word at opacity 1 and no blur.
  await scrubTo(page, 1);
  for (const word of await revealState(page)) {
    expect(word.opacity, `${word.text} fully revealed`).toBe(1);
    expect(word.blur, `${word.text} unblurred`).toBe(0);
  }

  // Scrubbing back reverses it — the reveal tracks scroll, it does not latch.
  await scrubTo(page, 0);
  for (const word of await revealState(page)) {
    expect(word.opacity).toBeCloseTo(0.2, 2);
    expect(word.blur).toBeCloseTo(4, 1);
  }
});

test('Chinese reveals by word, not by character, with punctuation attached', async ({ page }) => {
  await openEntrance(page);
  await page.locator('.d-language__option[data-locale="zh-Hant"]').click();
  await page.locator('[data-scene="question1"]').waitFor();

  const words = (await revealState(page)).map((word) => word.text);
  // Intl.Segmenter word granularity: 音樂 and 打動 are single units, not four
  // separate characters, and the comma rides with the word before it.
  expect(words).toContain('音樂');
  expect(words).toContain('打動，');
  expect(words).toContain('時候？');
  expect(words.join('')).toBe('上一次被音樂打動，是甚麼時候？');
  // Far fewer units than the 15 characters a per-character reveal would give.
  expect(words.length).toBeLessThan(12);
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
      anyButton: document.querySelectorAll('.d-entrance button').length
    };
  });

  expect(final.d).toBe('D');
  expect(final.awn).toBe('awn');
  expect(final.awnOpacity).toBeLessThan(0.02);
  expect(final.festival).toBe('D FESTIVAL');
  expect(final.festivalOpacity).toBeGreaterThan(0.98);
  // Nothing to press: the final frame carries no control at all.
  expect(final.anyButton).toBe(0);

  // The D is horizontally centred once `awn` has dissolved.
  const offset = await page.evaluate(() => {
    const rect = document.querySelector('.d-final__d').getBoundingClientRect();
    return Math.abs((rect.left + rect.right) / 2 - window.innerWidth / 2);
  });
  expect(offset).toBeLessThanOrEqual(2);

  // The passage runs once; it never loops back to the words.
  expect(await page.locator('[data-scene="words"]').count()).toBe(0);
});

test('the final frame enters the homepage on its own, with no press', async ({ page }) => {
  await openEntrance(page);
  await reachWords(page, 'en');
  await page.locator('[data-scene="final"]').waitFor({ timeout: 20_000 });

  // No control anywhere in the sequence to reach this point.
  expect(await page.locator('.d-entrance button').count()).toBe(0);

  // The zoom begins by itself once the composition has held.
  await expect
    .poll(async () => page.locator('.d-entrance').getAttribute('data-zooming'), { timeout: 6000 })
    .toBe('true');

  // The footage keeps playing while it travels, and the scrim clears.
  const during = await page.evaluate(() => {
    const video = document.querySelector('video');
    const scrim = document.querySelector('.d-entrance__scrim');
    return {
      playing: video ? !video.paused : false,
      scrimOpacity: scrim ? Number(getComputedStyle(scrim).opacity) : 1
    };
  });
  expect(during.playing).toBe(true);
  expect(during.scrimOpacity).toBeLessThan(1);

  // It lands in the homepage hero, still playing, marked completed.
  await expect(page.locator('.d-entrance')).toHaveCount(0, { timeout: 8000 });
  const after = await page.evaluate(() => {
    const video = document.querySelector('.site-hero video');
    return {
      inHero: Boolean(video),
      paused: video?.paused,
      outcome: localStorage.getItem('dFestival.entranceOutcome'),
      bodyOverflow: document.body.style.overflow,
      // The zoom's inline geometry must not be left on the layer.
      layerStyle: document.querySelector('.d-media-layer')?.getAttribute('style') ?? ''
    };
  });
  expect(after.inHero).toBe(true);
  expect(after.paused).toBe(false);
  expect(after.outcome).toBe('completed');
  expect(after.bodyOverflow).toBe('');
  expect(after.layerStyle).toBe('');
});

test('the cinematic bottom edge softens the footage without touching the text', async ({ page }) => {
  await openEntrance(page);
  const edge = page.locator('.d-entrance__filmedge');
  await expect(edge).toHaveCount(1);

  const layering = await page.evaluate(() => {
    const node = document.querySelector('.d-entrance__filmedge');
    const style = getComputedStyle(node);
    const ui = document.querySelector('.d-entrance__ui');
    const rect = node.getBoundingClientRect();
    return {
      zIndex: Number(style.zIndex),
      uiZIndex: Number(getComputedStyle(ui).zIndex),
      pointerEvents: style.pointerEvents,
      backdrop: style.backdropFilter || style.webkitBackdropFilter,
      atBottom: Math.abs(rect.bottom - window.innerHeight) <= 1,
      fullWidth: Math.abs(rect.width - window.innerWidth) <= 1
    };
  });

  // Above the footage, below the text, and never in the way of the gesture.
  expect(layering.zIndex).toBeLessThan(layering.uiZIndex);
  expect(layering.pointerEvents).toBe('none');
  expect(layering.backdrop).toContain('blur');
  expect(layering.atBottom).toBe(true);
  expect(layering.fullWidth).toBe(true);
});

test('the word passage carries no control at all', async ({ page }) => {
  await openEntrance(page);
  await reachWords(page, 'en');
  // Skip, pause and Enter were all removed at the client's request; the hold
  // gesture and Escape are the remaining ways out before it auto-enters.
  expect(await page.locator('.d-entrance button').count()).toBe(0);
});

test('the display faces are the ones the design specifies', async ({ page }) => {
  await openEntrance(page);
  await page.locator('.d-language__option[data-locale="zh-Hant"]').click();
  await page.locator('[data-scene="question1"]').waitFor();
  await expect
    .poll(async () => page.evaluate(() => document.fonts.status), { timeout: 8000 })
    .toBe('loaded');

  const faces = await page.evaluate(() => ({
    question: getComputedStyle(document.querySelector('.d-scene__question')).fontFamily,
    loaded: Array.from(document.fonts)
      .filter((face) => face.status === 'loaded')
      .map((face) => face.family)
  }));

  // Chinese resolves to the Hong Kong Song serif FIRST, ahead of any generic
  // serif that might also carry the glyphs. (The computed value quotes the
  // family name, so compare the first entry rather than a raw index.)
  expect(faces.question.split(',')[0].replace(/["']/g, '').trim()).toBe('Noto Serif HK');
  expect(new Set(faces.loaded)).toContain('Noto Serif HK');
  expect(new Set(faces.loaded)).toContain('Cormorant Garamond');
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
