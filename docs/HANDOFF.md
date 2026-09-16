# D Festival entrance — implementation handoff

Spec implemented: **D_Festival_Entrance_Design_Spec_v2_Responsive.md, v2.0**.

This document records what was built, what was actually tested, and what
**remains unverified**. Nothing below is described as verified unless a test
run produced the result.

---

## 1. Two dependencies you need to know about first

### 1.1 The performance footage was never available here

The Google Drive link in the brief could not be reached: this build
environment's network policy denied the connection
(`HTTP 403` to `CONNECT drive.google.com:443`). The video was never downloaded,
opened, or inspected.

Consequently:

- `src/entrance/mediaConfig.js` ships with `master.src = null`. **No invented
  filename is presented as existing footage.**
- All layout, geometry and crop testing used **synthetic test patterns**
  (`tests/fixtures/`), clearly labelled as such.
- **The final crop composition is NOT verified.** Cover geometry is verified;
  whether the crop keeps the right performer and the piano in frame is an
  editorial judgement that requires the real recording.
- Crop alignment is `50% 50%` for all three viewport shapes. That is an
  **untuned default, not a decision**. Tuning it needs frame-by-frame review of
  the real loop, including its shot changes.

With no media configured, the entrance runs its documented failure path:
full-screen black, white text, every control working. That path is tested.

### 1.2 The repository was empty

`jamesau0723/codextest` had **zero commits and zero branches** at the start of
this work. There was no existing website, framework, router, localization layer,
animation utility or test setup to implement inside.

The entrance is therefore written framework-free (native ES modules, plain CSS,
no bundler, no 3D engine, no new application framework — as the spec requires),
and integrates through four plain DOM contracts documented in `README.md`. The
homepage in this repository is a **minimal host shell**, not an attempt to build
the D Festival website.

### 1.3 "Consider using hyper frames" — how this was interpreted

The brief's phrase has no definition in the specification, so a judgement call
was made: it was read as **frame-accurate, high-resolution timing**, and every
timeline in the entrance is driven from one shared `requestAnimationFrame` loop
reading a monotonic, freezable `SceneClock` — not from chains of `setTimeout`
and not from CSS keyframes.

That reading is defensible on its own merits (it is what makes exact hold
cancellation, pause, and hidden-tab freeze possible) and conflicts with nothing
in the spec. It is explicitly **not** read as iframes, which the spec forbids
for the background. **If a different technique was meant, say so and it can be
revisited — nothing else depends on this reading.**

---

## 2. Test results

Command: `npm test` (Playwright). Full log: [`docs/test-run.txt`](./test-run.txt).
Last run: **110 passed, 0 failed** in 2.6 minutes.

| Suite | Tests | Result |
|---|---|---|
| `viewport.spec.js` — responsive matrix, cover geometry, rotation, zoom | 36 | pass |
| `sequence.spec.js` — scenes, languages, ten words, final D | 14 | pass |
| `hold.spec.js` — gesture thresholds, cancellation, pause | 17 | pass |
| `a11y.spec.js` — reduced motion, focus, keyboard, contrast | 12 | pass |
| `fallbacks.spec.js` — media failure, storage, routing, cleanup | 15 | pass |
| `locale.spec.js` — provisional language resolution, shape buckets | 6 | pass |
| `screenshots.spec.js` — evidence capture | 10 | pass |
| **Total** | **110** | **all passing** |

### Browser actually used

| Browser | Version | How |
|---|---|---|
| Chromium | **141.0.7390.37** (Playwright browser build 1194) | headless, this environment |

Test runner: Playwright **1.63.0**, Node **22.22.2**, Linux.
Full run log: [`docs/test-run.txt`](./test-run.txt).

**No other browser was run.** See section 4.

### Responsive matrix — every size asserted

Each entry asserts: root, video, poster and scrim edges within **1 CSS px** of
the browser rectangle; `object-fit: cover` on video *and* poster with identical
`object-position`; `position: fixed`, `max-width: none`, `aspect-ratio: auto`,
`border-radius: 0`; no horizontal document overflow; Skip/pause/hint inside the
viewport with ≥44×44 px targets.

| Class | Viewports | Result |
|---|---|---|
| Small phone | 320×568, 360×800 | pass |
| Typical/tall phone | 390×844, 430×932 | pass |
| Phone landscape | 844×390 | pass |
| Tablet portrait | 768×1024, 820×1180, 1024×1366 | pass |
| Tablet landscape | 1024×768, 1180×820 | pass |
| Resizable/split view | 500×900, 960×540, + continuous drag 340→1500 | pass |
| Laptop/desktop | 1366×768, 1440×900, 1920×1080 | pass |
| Ultrawide | 2560×1080, 3440×1440 | pass |

### Pixel-level checks (not just bounding boxes)

Bounding boxes cannot prove the *content* fills the box — a letterboxed frame
inside a full-size element has a perfect bounding box. So screenshots are
decoded and the pixels inspected (`tests/png.js`):

- **No black bars**: the first and last row and column of the rendered frame
  contain real image content at 1440×900 and 390×844.
- **No distortion**: the fixture's true circle is measured on both axes at
  1440×900. Source 1280×720, circle diameter 576 px, cover scale
  `max(1440/1280, 900/720) = 1.25` → **720 px expected on both axes**; measured
  within 12 px on each axis and of each other.
- **Side crop, not letterbox**: at 390×844 the height-driven scale 1.1722 gives
  an expected 675 px vertical diameter with horizontal cropping; measured within
  18 px.
- **Contrast**: composited against a **pure white** worst-case frame, the 60%
  black scrim yields white-on-background contrast of **≈5.6:1**, above the
  project's 4.5:1 target throughout. (Against the real footage this must be
  re-checked on the brightest actual frames; `--overlay-alpha` is the single
  knob to raise.)

### Behaviour verified

- 1499 ms hold does **not** skip; ≥1500 ms arms, previews the homepage while
  the pointer is still down, and commits **on release**.
- A hold begun on a language button skips **without** selecting that language;
  a short tap on the same button selects it.
- Cancellation: >12 px movement, second pointer, `pointercancel`, window blur,
  hidden document, and viewport change — none navigate, all restore the exact
  pre-hold scene time.
- A completed hold does **not** click the homepage underneath (counted: 0).
- Skip, Escape and Enter racing each other produce exactly **one** storage
  write and one navigation.
- Right mouse-button holds are not intercepted.
- Rotation mid-passage preserves scene, language, pause state and media
  position; the video is not reloaded and the timeline does not restart.
- Exactly **one** media source is requested per entrance session, across two
  rotations.
- Pause freezes video and scene time together, completes typed text, persists
  across scenes, and never blocks Continue/Enter/Skip.
- Reduced motion: no video fetched at all, questions shown in full, the timed
  passage replaced by a static ten-word list, a static hold label instead of a
  filling ring.
- Normal entry hands the still-playing video to the homepage — the timeline
  continues rather than restarting.

---

## 3. Screenshot evidence

In `docs/screenshots/`. **Every frame uses the synthetic test pattern, not the
performance footage.** They evidence layout, geometry, centring and state —
they are not evidence about the real crop composition.

| Group | Files |
|---|---|
| Full sequence at the three required sizes | `390x844-phone-*`, `820x1180-tablet-*`, `1440x900-desktop-*` (language, both questions, longest word, final D) |
| Chinese scripts | `390x844-zh-Hant-*`, `1440x900-zh-Hans-word-with-translation.png` |
| Portrait→landscape rotation | `rotation-1-portrait-390x844.png`, `rotation-2-landscape-844x390.png` |
| Crop previews, scrim removed | `crop-preview-{narrow,balanced,wide,ultrawide}-*.png` |
| Hold gesture | `hold-1-progress-390x844.png`, `hold-2-threshold-preview-390x844.png` |
| Fallbacks | `fallback-no-media-390x844.png`, `reduced-motion-static-words-1440x900.png` |

The crop previews are the images to re-generate **first** once the real footage
arrives — they are what the crop-alignment decision should be made from.

---

## 4. NOT verified — please read before launch

| # | Item | Status |
|---|---|---|
| 1 | **Real performance footage** | Never supplied or inspected. Final framing, crop alignment, brightest-frame contrast and file-size budgets are all unverified. |
| 2 | **Real iOS Safari** | **Not run.** No device or Safari build available here. Inline playback, address-bar expand/collapse, safe-area insets, rotation and gesture interception are unverified on iOS. |
| 3 | **Real Android Chrome** | **Not run.** Same caveats. |
| 4 | **Desktop Safari, Firefox, Edge** | **Not run.** Only headless Chromium 141 was available. Firefox/Safari `dvh`, `object-position` and Pointer Events behaviour is unverified. |
| 5 | **Legacy `dvh` fallback path** | The measured-height fallback is implemented but **never exercised**, because Chromium 141 supports `dvh`, so the code path is skipped. It needs a browser that lacks `dvh`. |
| 6 | **Assistive technology** | No screen reader was run. Semantics, focus order and announcements are asserted structurally in the DOM only. **No WCAG conformance is claimed.** |
| 7 | **Real pinch zoom** | Tested by shrinking the CSS viewport (the standard equivalent), not by actual pinch gestures on a touch device. |
| 8 | **Real touch and pen input** | The gesture is exercised through Playwright's mouse and synthetic `PointerEvent`s. Real finger and stylus input is unverified. |
| 9 | **Network/delivery budgets** | No real asset exists to measure. The 2–4 MB / 4–8 MB targets are unmeasured. |
| 10 | **Deployment and China delivery** | Nothing deployed. No hosting claim is made. |
| 11 | **Font licensing** | No webfont files are shipped or fetched. Source Serif 4 / Noto Serif TC/SC are declared in the stack with a system-serif fallback; licensed files must be obtained and served separately. |

Emulation is **not** treated as equivalent to real-device verification.

---

## 5. Deliberate judgement calls

1. **Advance control below a truly centred question.** The question sits at
   exactly x=50%, y=50%; Continue/Enter is absolutely positioned below it and
   excluded from that centring, as the spec requires. Below 560 px viewport
   height it rejoins the normal flow so it can never overlap the hold hint —
   the spec's "reachable controls over mathematically exact centring".
2. **Symmetric content reserve.** Top and bottom control bands are reserved
   symmetrically (`max` of the two) so reserving room does not pull the centre
   off 50%.
3. **Word sizing.** All ten words share one font size, measured against
   `Discernment` via a hidden probe and scaled down as a set when it would not
   fit. Verified at 320/360/390/430/768/1440/2560 px: one line, no wrap, centred
   within 1.5 px, one font size across all ten words.
4. **Escape marks `skipped`.** The spec lists Escape as an exit route alongside
   Skip and hold, and reserves `completed` for explicit Enter D.
5. **No pointer capture on the root.** Capturing would retarget events and break
   native button activation, which the spec explicitly warns against. The root
   already spans the entrance, so capture is unnecessary.
6. **Initial focus on the scene heading.** Skip is the first control in the
   entrance's DOM and focus-trap order (one Shift+Tab away, and the wrap target
   from the last control), while initial focus goes to the scene's accessible
   heading as the spec allows.
7. **Word sizing survives a late font swap.** A display webfont that loads
   after the first measurement would otherwise leave all ten words sized
   against the fallback's metrics, so the word set is re-fitted once
   `document.fonts.ready` resolves. Layout space is already reserved, so this
   adjusts size without shifting controls, and it is a no-op where no webfont
   is used — as in this repository, which ships none.
8. **VP8/WebM fixtures.** The ffmpeg bundled with Playwright is encode-only with
   no image decoders, so fixtures are recorded via Chromium's `MediaRecorder`.
   Production footage would normally be MP4/H.264; the media configuration
   carries the type either way.

---

## 6. Reproducing the results

```bash
npm install
npm run fixtures     # regenerate synthetic fixtures
npm test             # 110 tests
npx playwright test tests/screenshots.spec.js   # regenerate evidence
```

Nothing has been deployed or published, per instruction.
