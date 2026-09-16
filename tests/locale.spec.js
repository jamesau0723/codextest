/**
 * Provisional-language resolution (spec 3, Scene 1).
 */
import { test, expect } from '@playwright/test';

async function loadLocaleModule(page) {
  await page.goto('/index.html');
  return page.evaluateHandle(() => import('/src/entrance/locale.js'));
}

test('Chinese script tags are matched before regions', async ({ page }) => {
  const mod = await loadLocaleModule(page);
  const results = await mod.evaluate((m) => ({
    hantCn: m.normaliseTag('zh-Hant-CN'),   // script wins over region
    hansTw: m.normaliseTag('zh-Hans-TW'),
    hant: m.normaliseTag('zh-Hant'),
    hans: m.normaliseTag('zh-Hans')
  }));

  expect(results.hantCn).toBe('zh-Hant');
  expect(results.hansTw).toBe('zh-Hans');
  expect(results.hant).toBe('zh-Hant');
  expect(results.hans).toBe('zh-Hans');
});

test('without a script tag, regions decide', async ({ page }) => {
  const mod = await loadLocaleModule(page);
  const results = await mod.evaluate((m) => ({
    tw: m.normaliseTag('zh-TW'),
    hk: m.normaliseTag('zh-HK'),
    mo: m.normaliseTag('zh-MO'),
    cn: m.normaliseTag('zh-CN'),
    sg: m.normaliseTag('zh-SG'),
    bare: m.normaliseTag('zh'),
    en: m.normaliseTag('en-GB'),
    unsupported: m.normaliseTag('fr-FR')
  }));

  expect(results.tw).toBe('zh-Hant');
  expect(results.hk).toBe('zh-Hant');
  expect(results.mo).toBe('zh-Hant');
  expect(results.cn).toBe('zh-Hans');
  expect(results.sg).toBe('zh-Hans');
  // A bare `zh` falls back to Traditional as a product decision.
  expect(results.bare).toBe('zh-Hant');
  expect(results.en).toBe('en');
  expect(results.unsupported).toBeNull();
});

test('browser preferences are examined in order', async ({ page }) => {
  const mod = await loadLocaleModule(page);
  const results = await mod.evaluate((m) => ({
    firstSupported: m.localeFromBrowser(['fr-FR', 'de-DE', 'zh-HK', 'en-US']),
    noneSupported: m.localeFromBrowser(['fr-FR', 'de-DE']),
    empty: m.localeFromBrowser([])
  }));

  expect(results.firstSupported).toBe('zh-Hant');
  expect(results.noneSupported).toBeNull();
});

test('resolution order is URL, stored, browser, English', async ({ page }) => {
  const mod = await loadLocaleModule(page);
  const results = await mod.evaluate((m) => ({
    url: m.resolveProvisionalLocale({
      saved: 'zh-Hans', search: '?lang=en', languages: ['zh-TW']
    }),
    stored: m.resolveProvisionalLocale({
      saved: 'zh-Hans', search: '', languages: ['zh-TW']
    }),
    browser: m.resolveProvisionalLocale({
      saved: null, search: '', languages: ['zh-TW']
    }),
    fallback: m.resolveProvisionalLocale({
      saved: null, search: '', languages: ['fr-FR']
    }),
    unsupportedUrl: m.resolveProvisionalLocale({
      saved: 'zh-Hans', search: '?lang=fr', languages: ['fr-FR']
    })
  }));

  expect(results.url).toEqual({ locale: 'en', source: 'url' });
  expect(results.stored).toEqual({ locale: 'zh-Hans', source: 'stored' });
  expect(results.browser).toEqual({ locale: 'zh-Hant', source: 'browser' });
  expect(results.fallback).toEqual({ locale: 'en', source: 'default' });
  // An unsupported URL locale does not override the stored preference.
  expect(results.unsupportedUrl).toEqual({ locale: 'zh-Hans', source: 'stored' });
});

test('viewport shape thresholds match the documented buckets', async ({ page }) => {
  await page.goto('/index.html');
  const mod = await page.evaluateHandle(() => import('/src/entrance/mediaConfig.js'));
  const results = await mod.evaluate((m) => ({
    phonePortrait: m.viewportShape(390, 844),   // 0.462 -> narrow
    justUnderNarrow: m.viewportShape(69, 100),  // 0.69  -> narrow
    atNarrowEdge: m.viewportShape(70, 100),     // 0.70  -> balanced
    tablet: m.viewportShape(820, 1180),         // 0.695 -> narrow
    square: m.viewportShape(100, 100),          // 1.00  -> balanced
    justUnderWide: m.viewportShape(119, 100),   // 1.19  -> balanced
    atWideEdge: m.viewportShape(120, 100),      // 1.20  -> wide
    desktop: m.viewportShape(1440, 900),        // 1.60  -> wide
    ultrawide: m.viewportShape(3440, 1440)      // 2.39  -> wide
  }));

  expect(results).toEqual({
    phonePortrait: 'narrow',
    justUnderNarrow: 'narrow',
    atNarrowEdge: 'balanced',
    tablet: 'narrow',
    square: 'balanced',
    justUnderWide: 'balanced',
    atWideEdge: 'wide',
    desktop: 'wide',
    ultrawide: 'wide'
  });
});

test('production media configuration declares no invented assets', async ({ page }) => {
  await page.goto('/index.html');
  const mod = await page.evaluateHandle(() => import('/src/entrance/mediaConfig.js'));
  const config = await mod.evaluate((m) => ({
    masterSrc: m.MEDIA.master.src,
    masterPoster: m.MEDIA.master.poster,
    portrait: m.MEDIA.portrait,
    hasMedia: m.hasConfiguredMedia()
  }));

  // The real recording has not been supplied; nothing is faked in its place.
  expect(config.masterSrc).toBeNull();
  expect(config.masterPoster).toBeNull();
  expect(config.portrait).toBeNull();
  expect(config.hasMedia).toBe(false);
});
