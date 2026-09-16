/**
 * Provisional-language resolution (spec 3, Scene 1).
 */
import { test, expect } from '@playwright/test';
import {
  normaliseTag,
  localeFromBrowser,
  resolveProvisionalLocale
} from '../components/entrance/lib/locale';
import {
  viewportShape,
  selectSource,
  MEDIA,
  hasConfiguredMedia,
  COMPACT_MAX_WIDTH
} from '../components/entrance/lib/mediaConfig';

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

test('the supplied performance footage is wired up', () => {
  expect(MEDIA.master.src).toBe('/media/performance-master.mp4');
  expect(MEDIA.master.poster).toBe('/media/performance-poster.jpg');
  expect(MEDIA.master.width).toBe(1920);
  expect(MEDIA.master.height).toBe(1080);
  expect(hasConfiguredMedia()).toBe(true);
  // No approved portrait edit was supplied; the master covers portrait.
  expect(MEDIA.portrait).toBeNull();
});

test('crop alignment holds the soloist on the shapes that crop hardest', () => {
  const alignment = MEDIA.master.alignment!;
  // The soloist sits near x=27% of the frame, measured off the rendered crops:
  // a centred phone crop (spanning 37%-63%) loses him entirely, and a 35%
  // alignment (25.9%-51.9%) puts him on the very edge. Narrow shows 26% of the
  // width and balanced 42%, so both are pulled left of centre; wide shows 90%
  // and does not need to be.
  expect(Number.parseFloat(alignment.narrow.x)).toBeLessThan(35);
  expect(Number.parseFloat(alignment.balanced.x)).toBeLessThan(45);
  expect(alignment.wide.x).toBe('50%');
  for (const shape of ['narrow', 'balanced', 'wide'] as const) {
    expect(alignment[shape].y).toBe('50%');
  }

  // The visible window must contain the soloist with room to spare at both
  // edges, not merely clip him at one of them.
  const soloistX = 27;
  const margin = 4;
  const visibleFraction = { narrow: 0.26, balanced: 0.422, wide: 0.9 };
  for (const shape of ['narrow', 'balanced', 'wide'] as const) {
    const visible = visibleFraction[shape] * 100;
    const left = (100 - visible) * (Number.parseFloat(alignment[shape].x) / 100);
    const right = left + visible;
    expect(left, `${shape} window starts left of the soloist`).toBeLessThan(soloistX - margin);
    expect(right, `${shape} window ends right of the soloist`).toBeGreaterThan(soloistX + margin);
  }
});

test('a small viewport gets the compact encode, a large one the master', () => {
  expect(selectSource('narrow', 390).src).toBe('/media/performance-compact.mp4');
  expect(selectSource('balanced', COMPACT_MAX_WIDTH).src).toBe('/media/performance-compact.mp4');
  expect(selectSource('wide', COMPACT_MAX_WIDTH + 1).src).toBe('/media/performance-master.mp4');
  expect(selectSource('wide', 1440).src).toBe('/media/performance-master.mp4');
});
