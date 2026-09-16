/**
 * Provisional-language resolution (spec 3, Scene 1).
 */
import { test, expect } from '@playwright/test';
import {
  normaliseTag,
  localeFromBrowser,
  resolveProvisionalLocale
} from '../components/entrance/lib/locale';
import { viewportShape, MEDIA, hasConfiguredMedia } from '../components/entrance/lib/mediaConfig';

/**
 * These are pure functions, so they are exercised directly in Node rather than
 * round-tripped through the browser. Playwright transpiles the TypeScript.
 */

test('Chinese script tags are matched before regions', () => {
  const results = {
    hantCn: normaliseTag('zh-Hant-CN'),   // script wins over region
    hansTw: normaliseTag('zh-Hans-TW'),
    hant: normaliseTag('zh-Hant'),
    hans: normaliseTag('zh-Hans')
  };

  expect(results.hantCn).toBe('zh-Hant');
  expect(results.hansTw).toBe('zh-Hans');
  expect(results.hant).toBe('zh-Hant');
  expect(results.hans).toBe('zh-Hans');
});

test('without a script tag, regions decide', () => {
  const results = {
    tw: normaliseTag('zh-TW'),
    hk: normaliseTag('zh-HK'),
    mo: normaliseTag('zh-MO'),
    cn: normaliseTag('zh-CN'),
    sg: normaliseTag('zh-SG'),
    bare: normaliseTag('zh'),
    en: normaliseTag('en-GB'),
    unsupported: normaliseTag('fr-FR')
  };

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

test('browser preferences are examined in order', () => {
  const results = {
    firstSupported: localeFromBrowser(['fr-FR', 'de-DE', 'zh-HK', 'en-US']),
    noneSupported: localeFromBrowser(['fr-FR', 'de-DE'])
  };

  expect(results.firstSupported).toBe('zh-Hant');
  expect(results.noneSupported).toBeNull();
});

test('resolution order is URL, stored, browser, English', () => {
  const results = {
    url: resolveProvisionalLocale({ saved: 'zh-Hans', search: '?lang=en', languages: ['zh-TW'] }),
    stored: resolveProvisionalLocale({ saved: 'zh-Hans', search: '', languages: ['zh-TW'] }),
    browser: resolveProvisionalLocale({ saved: null, search: '', languages: ['zh-TW'] }),
    fallback: resolveProvisionalLocale({ saved: null, search: '', languages: ['fr-FR'] }),
    unsupportedUrl: resolveProvisionalLocale({
      saved: 'zh-Hans', search: '?lang=fr', languages: ['fr-FR']
    })
  };

  expect(results.url).toEqual({ locale: 'en', source: 'url' });
  expect(results.stored).toEqual({ locale: 'zh-Hans', source: 'stored' });
  expect(results.browser).toEqual({ locale: 'zh-Hant', source: 'browser' });
  expect(results.fallback).toEqual({ locale: 'en', source: 'default' });
  // An unsupported URL locale does not override the stored preference.
  expect(results.unsupportedUrl).toEqual({ locale: 'zh-Hans', source: 'stored' });
});

test('viewport shape thresholds match the documented buckets', () => {
  const results = {
    phonePortrait: viewportShape(390, 844),   // 0.462 -> narrow
    justUnderNarrow: viewportShape(69, 100),  // 0.69  -> narrow
    atNarrowEdge: viewportShape(70, 100),     // 0.70  -> balanced
    tablet: viewportShape(820, 1180),         // 0.695 -> narrow
    square: viewportShape(100, 100),          // 1.00  -> balanced
    justUnderWide: viewportShape(119, 100),   // 1.19  -> balanced
    atWideEdge: viewportShape(120, 100),      // 1.20  -> wide
    desktop: viewportShape(1440, 900),        // 1.60  -> wide
    ultrawide: viewportShape(3440, 1440)      // 2.39  -> wide
  };

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

test('production media configuration declares no invented assets', () => {
  const config = {
    masterSrc: MEDIA.master.src,
    masterPoster: MEDIA.master.poster,
    portrait: MEDIA.portrait,
    hasMedia: hasConfiguredMedia()
  };

  // The real recording has not been supplied; nothing is faked in its place.
  expect(config.masterSrc).toBeNull();
  expect(config.masterPoster).toBeNull();
  expect(config.portrait).toBeNull();
  expect(config.hasMedia).toBe(false);
});
