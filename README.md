# D Festival — website and entrance

Implementation of the D Festival entrance from
**D_Festival_Entrance_Design_Spec_v2_Responsive.md (v2.0)**.

The entrance is an **interactive web experience**: live HTML text, native
buttons and a real gesture layer above a full-viewport background video. It is
not a pre-rendered video with baked-in questions or controls.

> **Read `docs/HANDOFF.md` first.** It records what was tested, what passed,
> and — importantly — what could **not** be verified here: the real performance
> footage and real-device browsers.

## Running it

```bash
npm install          # Playwright only; there is no build step
npm run dev          # http://127.0.0.1:4173
npm run fixtures     # regenerate synthetic test media (not production footage)
npm test             # full Playwright suite
```

The entrance ships as native ES modules and plain CSS. There is no bundler, no
framework and no 3D engine.

## Repository state

This repository was **empty** when the work started — no commits, no existing
website, no routing or localization to integrate with. The instruction to
"implement within the existing framework" therefore had nothing to attach to,
so the entrance is written framework-free and mounts through two plain DOM
contracts that any stack can provide:

| Element | Role |
|---|---|
| `#entrance-root` | Top-level overlay/portal root, outside every page container |
| `#site-root` | Page content made `inert` while the entrance is open |
| `#main-content` | Receives focus after entry |
| `#d-entrance-template` | `<template>` holding the entrance markup |

The homepage and `programme.html` in this repository are a **minimal host
shell** so the entrance has something real to enter into (focus transfer,
deep-link bypass, Replay, locale propagation, no-JS behaviour). They are not an
attempt to build the D Festival website.

## Layout contract (spec 7)

The browser's available content viewport defines the canvas.

- Fixed root at `inset: 0`, `100dvh` with a conventional `100vh` fallback and a
  measured-height fallback **only** where `dvh` is unsupported.
- Video **and** poster: `width/height: 100%`, `object-fit: cover`, one shared
  `object-position`.
- No `aspect-ratio`, no `max-width`, no padding-ratio hack, no phone frame, no
  embedded third-party player, no transformed ancestor.
- Safe-area insets apply to **controls and text only** — never to the media or
  the scrim.
- Crop alignment follows viewport shape (`narrow` < 0.70 ≤ `balanced` < 1.20 ≤
  `wide`); alignment values are currently `50% 50%` everywhere because the real
  footage has not been inspected.

## Modules

| Module | Responsibility |
|---|---|
| `EntranceController` | Scene state, focus, pause, completion, cleanup |
| `PerformanceBackground` | Cover geometry, session-stable source, crop alignment, media failure |
| `EntranceViewport` | Dynamic height fallback, viewport shape, resize/rotation reporting |
| `EntranceContent` | Language choice, typed questions, word passage, final D, reduced-motion list |
| `EntranceControls` | Skip, pause/resume, hold hint, hold-progress ring |
| `HoldToSkip` | One Pointer Events state machine |
| `EntranceContentData` | Translations, word order, timings |
| `clock.js` | `SceneClock` + shared `FrameLoop` |
| `locale.js` / `storage.js` / `mediaConfig.js` | Locale resolution, persistence, media configuration |

### Frame-driven timing

Every timeline — typing, the word passage, the final transformation, hold
progress — is computed numerically from a monotonic `SceneClock` inside one
shared `requestAnimationFrame` loop, rather than from chains of `setTimeout` or
CSS keyframes. That is what makes pause, hidden-tab freeze, held-pointer
suspension and exact hold cancellation possible: the clock has reference-counted
freeze reasons, and any frame can be reconstructed from an elapsed value.

## Wiring up the real footage

Edit `src/entrance/mediaConfig.js`:

```js
master: {
  src: '/media/performance-master.mp4',
  type: 'video/mp4',
  poster: '/media/performance-poster.jpg',
  width: 1920,
  height: 1080,
  alignment: { narrow: {...}, balanced: {...}, wide: {...} }
},
portrait: null   // optional approved portrait edit
```

One clean landscape master is sufficient for every viewport. A portrait edit is
optional and improves composition only; its absence falls back to the master
with `cover`, never to `contain`.
