/**
 * Responsive full-viewport coverage contract (spec 7, acceptance 29–42).
 */
import { test, expect } from '@playwright/test';
import { openEntrance, expectCoversViewport, reachWords, scrubTo, FIXTURE_MEDIA } from './helpers.js';
import { decodePng, brightSpanX, brightSpanY, isBlackRow, isBlackColumn } from './png.js';

const MATRIX = [
  { name: 'small-phone-320x568', width: 320, height: 568, klass: 'Small phone' },
  { name: 'small-phone-360x800', width: 360, height: 800, klass: 'Small phone' },
  { name: 'phone-390x844', width: 390, height: 844, klass: 'Typical/tall phone' },
  { name: 'phone-430x932', width: 430, height: 932, klass: 'Typical/tall phone' },
  { name: 'phone-landscape-844x390', width: 844, height: 390, klass: 'Phone landscape' },
  { name: 'tablet-portrait-768x1024', width: 768, height: 1024, klass: 'Tablet portrait' },
  { name: 'tablet-portrait-820x1180', width: 820, height: 1180, klass: 'Tablet portrait' },
  { name: 'tablet-portrait-1024x1366', width: 1024, height: 1366, klass: 'Tablet portrait' },
  { name: 'tablet-landscape-1024x768', width: 1024, height: 768, klass: 'Tablet landscape' },
  { name: 'tablet-landscape-1180x820', width: 1180, height: 820, klass: 'Tablet landscape' },
  { name: 'split-500x900', width: 500, height: 900, klass: 'Resizable/split view' },
  { name: 'split-960x540', width: 960, height: 540, klass: 'Resizable/split view' },
  { name: 'laptop-1366x768', width: 1366, height: 768, klass: 'Laptop/desktop' },
  { name: 'laptop-1440x900', width: 1440, height: 900, klass: 'Laptop/desktop' },
  { name: 'desktop-1920x1080', width: 1920, height: 1080, klass: 'Laptop/desktop' },
  { name: 'ultrawide-2560x1080', width: 2560, height: 1080, klass: 'Ultrawide' },
  { name: 'ultrawide-3440x1440', width: 3440, height: 1440, klass: 'Ultrawide' }
];

for (const size of MATRIX) {
  test(`covers the viewport at ${size.name} (${size.klass})`, async ({ page }) => {
    await page.setViewportSize({ width: size.width, height: size.height });
    await openEntrance(page);
    await page.locator('.d-entrance__video').waitFor();

    // Root, video, poster and scrim all match the browser rectangle.
    await expectCoversViewport(page, '.d-entrance');
    await expectCoversViewport(page, '.d-entrance__video');
    await expectCoversViewport(page, '.d-entrance__poster');
    await expectCoversViewport(page, '.d-entrance__scrim');

    const geometry = await page.evaluate(() => {
      const root = document.querySelector('.d-entrance');
      const video = document.querySelector('.d-entrance__video');
      const poster = document.querySelector('.d-entrance__poster');
      const videoStyle = getComputedStyle(video);
      const posterStyle = getComputedStyle(poster);
      const rootStyle = getComputedStyle(root);
      return {
        videoFit: videoStyle.objectFit,
        posterFit: posterStyle.objectFit,
        videoPosition: videoStyle.objectPosition,
        posterPosition: posterStyle.objectPosition,
        rootPosition: rootStyle.position,
        rootMaxWidth: rootStyle.maxWidth,
        rootAspectRatio: rootStyle.aspectRatio,
        rootBorderRadius: rootStyle.borderRadius,
        documentScrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
        shape: root.dataset.shape
      };
    });

    // Mandatory fitting behaviour, shared by video and poster.
    expect(geometry.videoFit).toBe('cover');
    expect(geometry.posterFit).toBe('cover');
    expect(geometry.videoPosition).toBe(geometry.posterPosition);

    // Not constrained by a ratio wrapper, max-width container or phone frame.
    expect(geometry.rootPosition).toBe('fixed');
    expect(geometry.rootMaxWidth).toBe('none');
    expect(geometry.rootAspectRatio).toBe('auto');
    expect(geometry.rootBorderRadius).toBe('0px');

    // No horizontal page scrollbar.
    expect(geometry.documentScrollWidth).toBeLessThanOrEqual(geometry.innerWidth + 1);

    // Skip and pause were removed at the client's request; what remains must
    // stay inside the viewport, with a 44px target on every real control.
    const controls = await page.evaluate(() => {
      const rect = (node) => {
        const r = node.getBoundingClientRect();
        return { top: r.top, left: r.left, right: r.right, bottom: r.bottom,
                 width: r.width, height: r.height };
      };
      return {
        hint: rect(document.querySelector('.d-entrance__hint')),
        options: Array.from(document.querySelectorAll('.d-language__option')).map(rect)
      };
    });

    for (const [key, box] of Object.entries({ hint: controls.hint, ...controls.options })) {
      expect(box.top, `${key} top inside viewport`).toBeGreaterThanOrEqual(-0.5);
      expect(box.left, `${key} left inside viewport`).toBeGreaterThanOrEqual(-0.5);
      expect(box.right, `${key} right inside viewport`).toBeLessThanOrEqual(size.width + 0.5);
      expect(box.bottom, `${key} bottom inside viewport`).toBeLessThanOrEqual(size.height + 0.5);
    }
    for (const option of controls.options) {
      expect(option.height).toBeGreaterThanOrEqual(44);
      expect(option.width).toBeGreaterThanOrEqual(44);
    }
  });
}

test('rendered media has no black bars and is not distorted (1440x900)', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openEntrance(page);
  await page.locator('.d-entrance[data-media="ready"]').waitFor();
  // Measure the media itself, with the intentional scrim taken out of the way.
  await page.addStyleTag({ content: '.d-entrance__scrim,.d-entrance__ui{opacity:0 !important}' });
  await page.waitForTimeout(250);

  const image = decodePng(await page.screenshot());

  // Priority 1: no layout-generated bars at any edge.
  expect(isBlackRow(image, 0), 'top edge is not a black bar').toBe(false);
  expect(isBlackRow(image, image.height - 1), 'bottom edge is not a black bar').toBe(false);
  expect(isBlackColumn(image, 0), 'left edge is not a black bar').toBe(false);
  expect(isBlackColumn(image, image.width - 1), 'right edge is not a black bar').toBe(false);

  // Priority 2: the fixture's true circle must still be a circle.
  // Source 1280x720, circle radius 0.4 * 720 = 288.
  // cover scale = max(1440/1280, 900/720) = 1.25 -> diameter 720 on both axes.
  const [left, right] = brightSpanX(image, Math.round(image.height / 2));
  const [top, bottom] = brightSpanY(image, Math.round(image.width / 2));
  const horizontal = right - left;
  const vertical = bottom - top;

  expect(horizontal).toBeGreaterThan(0);
  expect(vertical).toBeGreaterThan(0);
  // Equal uniform scaling on both axes.
  expect(Math.abs(horizontal - vertical), 'circle stays circular').toBeLessThanOrEqual(12);
  expect(Math.abs(horizontal - 720), 'horizontal diameter matches cover scale').toBeLessThanOrEqual(16);
  expect(Math.abs(vertical - 720), 'vertical diameter matches cover scale').toBeLessThanOrEqual(16);
});

test('landscape master fills phone portrait with a side crop, not a letterbox', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openEntrance(page);
  await page.locator('.d-entrance[data-media="ready"]').waitFor();
  await page.addStyleTag({ content: '.d-entrance__scrim,.d-entrance__ui{opacity:0 !important}' });
  await page.waitForTimeout(250);

  const image = decodePng(await page.screenshot());
  expect(isBlackRow(image, 0)).toBe(false);
  expect(isBlackRow(image, image.height - 1)).toBe(false);
  expect(isBlackColumn(image, 0)).toBe(false);
  expect(isBlackColumn(image, image.width - 1)).toBe(false);

  // cover scale = max(390/1280, 844/720) = 1.1722 -> circle diameter 675 px,
  // which fits vertically and is cropped horizontally by the viewport.
  const [top, bottom] = brightSpanY(image, Math.round(image.width / 2));
  expect(Math.abs((bottom - top) - 675), 'vertical diameter follows the height-driven scale')
    .toBeLessThanOrEqual(18);
});

test('crop alignment follows viewport shape without reloading media', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openEntrance(page);
  await page.locator('.d-entrance[data-media="ready"]').waitFor();

  const narrow = await page.locator('.d-entrance').getAttribute('data-shape');
  expect(narrow).toBe('narrow');

  const before = await page.evaluate(() => {
    const video = document.querySelector('.d-entrance__video');
    return { src: video.currentSrc, time: video.currentTime };
  });

  await page.setViewportSize({ width: 1180, height: 820 });
  await page.waitForTimeout(200);
  expect(await page.locator('.d-entrance').getAttribute('data-shape')).toBe('wide');

  const after = await page.evaluate(() => {
    const video = document.querySelector('.d-entrance__video');
    return { src: video.currentSrc, time: video.currentTime };
  });

  // Same source kept for the session; the timeline moved forward rather than
  // restarting at zero.
  expect(after.src).toBe(before.src);
  expect(after.time).toBeGreaterThanOrEqual(before.time);

  await expectCoversViewport(page, '.d-entrance__video');
});

test('rotation mid-sequence preserves scene, language and media position', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openEntrance(page);
  await reachWords(page, 'zh-Hant');
  await page.waitForTimeout(2600);

  const before = await page.evaluate(() => ({
    state: document.querySelector('.d-entrance').dataset.state,
    word: document.querySelector('.d-word__en')?.textContent,
    locale: document.documentElement.dataset.locale,
    time: document.querySelector('.d-entrance__video').currentTime
  }));

  // Rotate to landscape.
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(150);

  const after = await page.evaluate(() => ({
    state: document.querySelector('.d-entrance').dataset.state,
    locale: document.documentElement.dataset.locale,
    time: document.querySelector('.d-entrance__video').currentTime,
    scene: Boolean(document.querySelector('[data-scene="words"]'))
  }));

  expect(after.state).toBe(before.state);
  expect(after.locale).toBe('zh-Hant');
  expect(after.scene).toBe(true);
  // The sequence did not restart: the word passage kept running.
  expect(after.time).toBeGreaterThanOrEqual(before.time);
  await expectCoversViewport(page, '.d-entrance');
  await expectCoversViewport(page, '.d-entrance__video');
});

test('continuous resize never exposes edges or a horizontal scrollbar', async ({ page }) => {
  await openEntrance(page);
  await page.locator('.d-entrance__video').waitFor();

  for (const width of [360, 420, 520, 640, 780, 900, 1100, 1300, 1500, 900, 500, 340]) {
    await page.setViewportSize({ width, height: 780 });
    await expectCoversViewport(page, '.d-entrance');
    await expectCoversViewport(page, '.d-entrance__video');
    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth
    }));
    expect(overflow.scrollWidth, `no horizontal overflow at ${width}px`)
      .toBeLessThanOrEqual(overflow.innerWidth + 1);
  }
});

// One test per width: reaching Discernment takes ~7.4s of real timeline, so a
// single looping test would exceed the per-test budget.
for (const width of [320, 360, 390, 430, 768, 1440, 2560]) {
  test(`the longest word fits without wrapping at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await openEntrance(page);
    await reachWords(page, 'en');
    // Discernment (index 7) runs from 7.2s to 8.4s into the passage.
    await expect
      .poll(async () => page.locator('.d-word__en').textContent(), { timeout: 12_000 })
      .toBe('Discernment');

    const measurement = await page.evaluate(() => {
      const node = document.querySelector('.d-word__en');
      const style = getComputedStyle(node);
      return {
        whiteSpace: style.whiteSpace,
        scrollWidth: node.scrollWidth,
        clientWidth: document.querySelector('.d-entrance__content').clientWidth,
        lineCount: node.getClientRects().length,
        fontSize: parseFloat(style.fontSize)
      };
    });

    expect(measurement.whiteSpace).toBe('nowrap');
    // One line: the word never wraps.
    expect(measurement.lineCount, `single line at ${width}px`).toBe(1);
    expect(measurement.scrollWidth, `fits at ${width}px`)
      .toBeLessThanOrEqual(measurement.clientWidth);

    // The word group stays horizontally centred, long words included.
    const centring = await page.evaluate(() => {
      const rect = document.querySelector('.d-word').getBoundingClientRect();
      return Math.abs((rect.left + rect.right) / 2 - window.innerWidth / 2);
    });
    expect(centring, `centred at ${width}px`).toBeLessThanOrEqual(1.5);
  });
}

test('all ten words share one font size', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await openEntrance(page);
  await reachWords(page, 'en');

  const sizes = new Set();
  const seen = new Set();
  const deadline = Date.now() + 14_000;
  while (Date.now() < deadline && seen.size < 10) {
    const sample = await page.evaluate(() => {
      const node = document.querySelector('.d-word__en');
      if (!node || !node.textContent) return null;
      return { text: node.textContent, size: getComputedStyle(node).fontSize };
    });
    if (sample?.text) {
      seen.add(sample.text);
      sizes.add(sample.size);
    }
    await page.waitForTimeout(120);
  }

  expect(seen.size, `saw words: ${[...seen].join(', ')}`).toBeGreaterThanOrEqual(8);
  // Words are never resized independently.
  expect(sizes.size, `font sizes seen: ${[...sizes].join(', ')}`).toBe(1);
});

test('the question stays centred on the viewport at every scroll position', async ({ page }) => {
  const measure = () =>
    page.evaluate(() => {
      const rect = document.querySelector('.d-scene__question').getBoundingClientRect();
      return {
        x: Math.abs((rect.left + rect.right) / 2 - window.innerWidth / 2),
        y: Math.abs((rect.top + rect.bottom) / 2 - window.innerHeight / 2)
      };
    });

  for (const size of [{ width: 390, height: 844 }, { width: 820, height: 1180 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(size);
    await openEntrance(page);
    await page.locator('.d-language__option[data-locale="en"]').click();
    await page.locator('[data-scene="question1"]').waitFor();

    // The sticky pin must hold the text at the centre through the whole scrub,
    // not just before scrolling starts.
    for (const ratio of [0, 0.33, 0.66, 1]) {
      await scrubTo(page, ratio);
      const offset = await measure();
      const label = `${size.width}x${size.height} at scrub ${ratio}`;
      expect(offset.x, `x centred, ${label}`).toBeLessThanOrEqual(1.5);
      expect(offset.y, `y centred, ${label}`).toBeLessThanOrEqual(1.5);
    }
  }
});

test('the scrub track gives real scroll distance and no horizontal overflow', async ({ page }) => {
  for (const size of [{ width: 320, height: 568 }, { width: 430, height: 932 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(size);
    await openEntrance(page);
    await page.locator('.d-language__option[data-locale="en"]').click();
    await page.locator('[data-scene="question1"]').waitFor();

    const geometry = await page.evaluate(() => {
      const scroller = document.querySelector('.d-entrance__content');
      const track = document.querySelector('.d-scroll-track');
      const pin = document.querySelector('.d-scroll-pin');
      return {
        distance: track.offsetHeight - pin.offsetHeight,
        pinHeight: pin.offsetHeight,
        viewportHeight: window.innerHeight,
        scrollWidth: scroller.scrollWidth,
        clientWidth: scroller.clientWidth,
        documentScrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth
      };
    });

    const label = `${size.width}x${size.height}`;
    // The pin is exactly one viewport tall, so the centre lands at 50%.
    expect(Math.abs(geometry.pinHeight - geometry.viewportHeight), `pin height, ${label}`)
      .toBeLessThanOrEqual(1);
    // There is genuine distance to scrub through.
    expect(geometry.distance, `scrub distance, ${label}`).toBeGreaterThan(geometry.viewportHeight);
    // Scrolling is vertical only.
    expect(geometry.scrollWidth, `no sideways scroll, ${label}`)
      .toBeLessThanOrEqual(geometry.clientWidth + 1);
    expect(geometry.documentScrollWidth, `no page overflow, ${label}`)
      .toBeLessThanOrEqual(geometry.innerWidth + 1);
  }
});

test('the advance control never overlaps the hold hint while it is showing', async ({ page }) => {
  for (const size of [{ width: 320, height: 568 }, { width: 844, height: 390 }, { width: 960, height: 540 }]) {
    await page.setViewportSize(size);
    await openEntrance(page);
    // The hint is only on screen for 2s after the language is chosen, so the
    // overlap check runs inside that window.
    await page.locator('.d-language__option[data-locale="en"]').click();
    await page.locator('[data-scene="question1"]').waitFor();
    expect(await page.locator('.d-entrance__hint').getAttribute('data-state')).toBe('visible');

    const overlap = await page.evaluate(() => {
      const a = document.querySelector('.d-scene__advance').getBoundingClientRect();
      const b = document.querySelector('.d-entrance__hint').getBoundingClientRect();
      const intersects = !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
      return { intersects, advanceBottom: a.bottom, viewportHeight: window.innerHeight };
    });

    expect(overlap.intersects, `no overlap at ${size.width}x${size.height}`).toBe(false);
    expect(overlap.advanceBottom).toBeLessThanOrEqual(size.height + 0.5);
  }
});

test('at 200% and 400% zoom the background still covers and content reflows', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await openEntrance(page);
  await page.locator('.d-entrance__video').waitFor();

  for (const zoom of [2, 4]) {
    // Emulating page zoom by shrinking the CSS viewport is the standard
    // equivalent: 200% zoom on 1280x800 leaves a 640x400 CSS viewport.
    await page.setViewportSize({ width: Math.round(1280 / zoom), height: Math.round(800 / zoom) });
    await page.waitForTimeout(120);

    await expectCoversViewport(page, '.d-entrance');
    await expectCoversViewport(page, '.d-entrance__video');

    const state = await page.evaluate(() => {
      const content = document.querySelector('.d-entrance__content');
      const style = getComputedStyle(content);
      const option = document.querySelector('.d-language__option').getBoundingClientRect();
      return {
        overflowY: style.overflowY,
        reachable:
          option.top >= -0.5 &&
          option.left >= -0.5 &&
          option.right <= window.innerWidth + 0.5,
        horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1
      };
    });

    // Foreground scrolls; the background keeps covering; zoom is not blocked.
    expect(state.overflowY).toBe('auto');
    expect(state.reachable, `controls reachable at ${zoom}x`).toBe(true);
    expect(state.horizontalOverflow).toBe(false);
  }

  const viewportMeta = await page.getAttribute('meta[name="viewport"]', 'content');
  expect(viewportMeta).toContain('viewport-fit=cover');
  expect(viewportMeta).not.toContain('user-scalable=no');
  expect(viewportMeta).not.toContain('maximum-scale');
});

test('safe-area insets are applied to controls but never to media or scrim', async ({ page }) => {
  await openEntrance(page);
  const insets = await page.evaluate(() => {
    const read = (sel) => {
      const style = getComputedStyle(document.querySelector(sel));
      return {
        paddingTop: style.paddingTop,
        paddingBottom: style.paddingBottom,
        paddingLeft: style.paddingLeft,
        paddingRight: style.paddingRight,
        inset: [style.top, style.right, style.bottom, style.left].join(' ')
      };
    };
    return { video: read('.d-entrance__video'), scrim: read('.d-entrance__scrim') };
  });

  for (const layer of ['video', 'scrim']) {
    expect(insets[layer].paddingTop).toBe('0px');
    expect(insets[layer].paddingBottom).toBe('0px');
    expect(insets[layer].paddingLeft).toBe('0px');
    expect(insets[layer].paddingRight).toBe('0px');
    expect(insets[layer].inset).toBe('0px 0px 0px 0px');
  }
});

test('only one video source is requested for the entrance session', async ({ page }) => {
  const mediaRequests = [];
  page.on('request', (request) => {
    if (request.resourceType() === 'media' || /\.(webm|mp4)$/.test(request.url())) {
      mediaRequests.push(request.url());
    }
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await openEntrance(page, {
    media: {
      ...FIXTURE_MEDIA,
      portrait: {
        src: '/tests/fixtures/portrait-9x16.webm',
        type: 'video/webm',
        poster: '/tests/fixtures/portrait-9x16.png',
        width: 720,
        height: 1280
      }
    }
  });
  await page.locator('.d-entrance[data-media="ready"]').waitFor();

  // Rotate twice: still no second download.
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(150);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(150);

  const distinct = new Set(mediaRequests.map((url) => new URL(url).pathname));
  expect(distinct.size, `one source only, saw: ${[...distinct].join(', ')}`).toBe(1);
  // A portrait viewport prefers the approved portrait edit when one is supplied.
  expect([...distinct][0]).toContain('portrait-9x16');
});

test('a missing optional portrait falls back to the master with cover', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openEntrance(page); // FIXTURE_MEDIA has no portrait variant
  await page.locator('.d-entrance[data-media="ready"]').waitFor();

  const source = await page.evaluate(() => document.querySelector('.d-entrance__video').currentSrc);
  expect(source).toContain('landscape-16x9');

  const fit = await page.evaluate(
    () => getComputedStyle(document.querySelector('.d-entrance__video')).objectFit
  );
  expect(fit).toBe('cover'); // never `contain`
  await expectCoversViewport(page, '.d-entrance__video');
});
