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

## 1.4 Client-directed deviations from spec v2.0

Four changes were requested after the spec was implemented. They are genuine
departures from the authoritative document, recorded here so nobody later reads
the spec and assumes the build matches it.

| # | Change | Spec it departs from | Consequence |
|---|---|---|---|
| A | Typewriter questions replaced by a **scroll-scrubbed word reveal**, in Framer Motion | §2 (1,000 ms typing), §3 | Reading the question now requires scrolling |
| B | **Skip control removed** (top right) | §2, §5, §8, acceptance 10 | One of four exit routes is gone |
| C | **Pause/resume control removed** (bottom left) | §5, acceptance 18 | See the accessibility note below |
| D | Hold hint made **transient** — appears after the language choice, holds 2 s, fades | §5 (persistent hint) | The remaining shortcut is advertised only briefly |
| E | **Enter D removed**; the final frame enters the homepage by itself | §2, §3, acceptance 5/27 | No control remains anywhere in the animated sequence |
| F | The entrance leaves by **zooming the footage into the homepage hero** | §3 (450 ms opacity exit) | A 1.5 s motion replaces the cross-fade |
| G | A **cinematic soft edge** blurs and darkens the bottom of the footage | — (addition, not a departure) | Slightly reduces visible frame area at the bottom |

### These two are worth a second look

**Removing pause is an accessibility regression.** WCAG 2.2.2 (Pause, Stop,
Hide) asks for a pause mechanism for motion that starts automatically and runs
more than five seconds. The entrance has exactly that: a looping background
video and a 12.2-second word passage. The pause control was the mechanism, and
it is now gone. What still mitigates it: `prefers-reduced-motion` is fully
honoured (no video is fetched at all, and the timed passage becomes a static
list), and playback still freezes on a hidden tab and during a hold. The
underlying `setPaused` machinery is intact, so restoring the button is a small
change if you want it back.

**With Enter D also gone, the word passage has no visible control at all.**
After the two questions, a visitor who wants out before the 12.2-second passage
finishes has only the hold gesture (advertised for two seconds, back at the
language step) or the Escape key. Everyone else simply waits about fourteen
seconds and is carried in automatically. Nobody is trapped, but the passage is
now a lean-back moment with no visible affordance — worth knowing if the
footage ever runs longer.

**One Enter D deliberately survives: the reduced-motion list.** That path
replaces the timed passage with a static list, so there is no animation to
finish and nothing to auto-complete from. Removing its control would leave
reduced-motion visitors with only a 1.5-second hold or a key press, which is
exactly the population least well served by that. Spec §8 requires Enter D to
stay available there, and it does.

Neither change was blocked, because neither makes the entrance unusable and
both are the client's call. They are flagged, not overridden.

### The automatic exit

Once `D FESTIVAL` has settled, the composition holds for 1.1 s and then the
entrance enters the site by itself:

1. the scrim, the cinematic edge and all text clear over 520 ms;
2. the entrance's own black background animates to transparent, so the homepage
   appears around the shrinking frame;
3. the media layer travels from the full viewport down to the hero's rectangle
   over 1.5 s on a symmetric ease;
4. it is then handed to the hero and the entrance unmounts, with the outcome
   recorded as `completed`.

**The layout box is animated, not a transform.** A transform would be cheaper,
but scaling a full-viewport rectangle into a wide, short hero is non-uniform,
and the footage would visibly squash on the way down — the one thing the whole
cover contract exists to prevent. Animating `top/left/width/height` lets
`object-fit: cover` re-solve every frame, so the crop tightens but nothing
distorts. It is one out-of-flow element, so the per-frame layout is cheap.

Body scroll is released and the hero scrolled into view before the rectangle is
measured, so the move still lands correctly on a page taller than the fold.

Reduced motion skips the zoom entirely and falls back to the ordinary fade, as
do a missing hero, an unplayable video and any interrupted animation.

### The cinematic bottom edge

A band along the bottom of the footage blurs its own backdrop through a gradient
mask, so the blur is strongest at the very bottom and has reached nothing by the
top of the band. A darkening gradient sits underneath and carries the effect on
its own where `backdrop-filter` is unavailable. It sits above the scrim and
below the UI layer, so it softens the footage and never the text, and it takes
no pointer events, so it cannot interfere with the hold gesture.

### React-specific notes

- **Scene transitions** use `AnimatePresence mode="wait"`, so two scenes are
  never in the same grid cell at once. The cost is that focus briefly falls to
  `body` during the 250 ms gap before the next scene's heading takes it.
- **The media element is owned by `EntranceGate`, not the entrance**, and lives
  in a plain DOM layer that the entrance adopts while open. That is what lets a
  playing video be handed to the homepage on entry instead of being unmounted
  and recreated — React would otherwise destroy it with the entrance subtree.
- **The homepage is a server component**, so its markup is in the HTML with or
  without JavaScript. The `?media=` test seam is read client-side inside the
  gate; reading it with `useSearchParams` at page level would have forced the
  entire page to render client-only.
- **Per-frame work avoids React re-renders**: the word passage and the final
  transformation write to motion values inside `useAnimationFrame`, so React
  renders ten times across the passage rather than sixty times a second.

### How the scroll reveal preserves the centring rule

The spec requires the question centred at x=50%, y=50% of the viewport. A
scroll interaction would normally break that. The implementation keeps it: a
tall `.d-scroll-track` supplies the scroll distance while a `position: sticky`
`.d-scroll-pin`, exactly one viewport tall, holds the text at dead centre for
the whole scrub. This is asserted at four scrub positions across three
viewports.

Reveal values follow the request exactly: each word starts at `opacity: 0.2`
with `filter: blur(4px)` and ends at `opacity: 1`, `filter: none`, with a
staggered window so the cascade overlaps rather than stepping. Nothing is
time-driven — a test asserts that waiting 1.6 s with no scrolling changes
nothing at all, and that scrubbing backwards reverses the reveal.

Chinese is segmented with `Intl.Segmenter` at word granularity, so it reveals
音樂 / 打動 as units rather than one character at a time; punctuation rides with
the word before it.

### Typography

| Role | Face | Why |
|---|---|---|
| Latin display | **Cormorant Garamond** 300/400 | High-contrast Garamond with calligraphic proportions and fine hairlines. Its capital D carries the final reveal, where a single letterform has to hold the screen by itself. |
| Traditional Chinese | **Noto Serif HK** 300/400 | Hong Kong glyph forms, not Taiwanese — correct for a Hong Kong programme. A Song/Ming serif matches Cormorant's modulated strokes. |
| Simplified Chinese | **Noto Serif SC** 300/400 | The same Song serif in mainland forms. |
| Controls and labels | **Jost** 300/400/500 | A geometric sans in the Futura tradition; light weights with open tracking read as exhibition signage rather than UI chrome. |

All four are SIL Open Font License, so they ship with the site — the earlier
"obtain licensed assets separately" dependency is closed.

**Delivery.** Latin comes through `next/font`, which self-hosts it at build
time: no runtime third-party request and no layout shift. Chinese does **not**
— letting `next/font` self-host a CJK family produced 223 files and 14 MB here.
The site uses about 150 distinct Chinese characters, all known ahead of time, so
`npm run fonts` asks Google Fonts for a subset containing exactly those glyphs
and writes four woff2 files totalling **132 KB**. The character set is read from
the source files, so adding a word and re-running keeps it in sync.

**One ordering trap worth knowing.** `next/font`'s CSS variable already ends in
a generic `serif`, so appending the Chinese families after it puts them behind a
family that usually *has* Chinese glyphs — and the subsets would never be
reached. Chinese is therefore selected by each element's own `lang` and placed
first in its own stack. This was caught by reading the computed
`font-family`, not by looking at the page: it rendered correctly here by
accident, because this machine's generic serif happens to lack the glyphs.

### Stack: ported to Next.js, React and Framer Motion

The entrance was first built vanilla, because the repository was empty and spec
§10 forbids adding an application framework for the entrance alone. The client
then confirmed the updated D Festival website will be **Next.js + React**, which
makes React the destination rather than an addition, so the whole entrance was
ported. The vanilla implementation is gone; it remains in git history at
`ff3ab39`.

| Layer | Now |
|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript (strict) |
| Animation | Framer Motion 13 — `useScroll`, `useTransform`, `useAnimationFrame`, `AnimatePresence` |
| Styling | Plain global CSS, class names unchanged from the vanilla build |
| Entry point | `<EntranceGate eligible />` inside `components/site/SiteShell.tsx` |

**Dropping it into the real site** needs three things: `components/entrance/`
copied across, `app/entrance.css` imported once, and `<EntranceGate eligible />`
rendered on the homepage with `#site-root` and `#main-content` present. Media
paths go in `components/entrance/lib/mediaConfig.ts`.

TypeScript was chosen because it is the Next.js default and the request asked
for production-ready code. If the real site is plain JavaScript, stripping the
types is mechanical — nothing depends on them at runtime.

**The scroll reveal is now literally what was asked for**: `useTransform` maps
scroll progress to each word's `opacity` and `filter`, with `useScroll`
measuring a tall track against its sticky pin. One deviation from the obvious
form is deliberate and commented in `ScrollRevealText.tsx`: both properties are
derived from an explicit callback rather than a range-based `useTransform`,
because the range form returned a value for the first word that disagreed with
the blur computed from the same progress.

---

## 2. Test results

Command: `npm test` (Playwright). Full log: [`docs/test-run.txt`](./test-run.txt).
Last run: **116 passed, 0 failed**.

| Suite | Tests | Result |
|---|---|---|
| `viewport.spec.js` — responsive matrix, cover geometry, scrub track, rotation, zoom | 37 | pass |
| `sequence.spec.js` — scenes, languages, scroll reveal, ten words, final D | 15 | pass |
| `hold.spec.js` — gesture thresholds, cancellation, transient hint | 17 | pass |
| `a11y.spec.js` — reduced motion, focus, keyboard, contrast | 12 | pass |
| `fallbacks.spec.js` — media failure, storage, routing, cleanup | 15 | pass |
| `locale.spec.js` — provisional language resolution, shape buckets | 6 | pass |
| `screenshots.spec.js` — evidence capture | 10 | pass |
| **Total** | **116** | **all passing** |

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
- Repeated exits racing each other produce exactly **one** storage write and
  one navigation.
- Right mouse-button holds are not intercepted.
- Rotation mid-passage preserves scene, language, pause state and media
  position; the video is not reloaded and the timeline does not restart.
- Exactly **one** media source is requested per entrance session, across two
  rotations.
- The hold hint is absent during language choice, appears on selection, holds,
  then fades to `hidden` and never returns.
- The question reveal is monotonic across words, reverses on scrolling back,
  and does not move when time passes.
- Reduced motion: no video fetched at all, questions shown in full with no
  scrub track and no scrolling required, the timed passage replaced by a static
  ten-word list, a static hold label instead of a filling ring.
- Normal entry hands the still-playing video to the homepage — the timeline
  continues rather than restarting.

---

## 3. Screenshot evidence

In `docs/screenshots/`. **Every frame uses the synthetic test pattern, not the
performance footage.** They evidence layout, geometry, centring and state —
they are not evidence about the real crop composition.

| Group | Files |
|---|---|
| Full sequence at the three required sizes | `390x844-phone-*`, `820x1180-tablet-*`, `1440x900-desktop-*` — language, question 1 **unrevealed / scrubbing / revealed**, question 2 scrubbing, longest word, final D |
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
npm test             # 116 tests
npx playwright test tests/screenshots.spec.js   # regenerate evidence
```

Nothing has been deployed or published, per instruction.
