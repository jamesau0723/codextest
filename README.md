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
npm install
npm run dev          # Next.js dev server
npm run build        # production build
npm test             # full Playwright suite (builds, then serves)
npm run fixtures     # regenerate synthetic test media (not production footage)
```

Next.js 16 (App Router), React 19, TypeScript, Framer Motion 13.

## Dropping it into the real site

Copy `components/entrance/`, import `app/entrance.css` once, and render the gate
on the homepage:

```tsx
import { EntranceGate } from '@/components/entrance/EntranceGate';

<div id="site-root">…your page…<main id="main-content">…</main></div>
<EntranceGate eligible />
```

Two DOM contracts the host page must provide:

| Element | Role |
|---|---|
| `#site-root` | Page content, made `inert` while the entrance is open |
| `#main-content` | Receives focus after entry |

Optional: `data-reuses-entrance-video` on a hero element makes it adopt the
still-playing video on a normal entry instead of restarting one.

The pages in `app/` are a **minimal host shell** so the entrance has something
real to enter into. They are not an attempt to build the D Festival website.

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

## Components

| File | Responsibility |
|---|---|
| `EntranceGate` | Eligibility, routing, Replay, and ownership of the media layer |
| `DFestivalEntrance` | Scene state, focus, the hold gesture, completion |
| `ScrollRevealText` | The scroll-scrub word reveal (`useTransform`) |
| `QuestionScene` | Sticky-pin scrub track (`useScroll`) |
| `WordPassage` / `FinalD` | Clock-driven timelines (`useAnimationFrame`) |
| `PerformanceBackground` | Cover geometry, session-stable source, crop alignment, failures |
| `HoldFeedback` | Hold ring and the transient hint |
| `hooks/useHoldToSkip` | One Pointer Events state machine |
| `hooks/useEntranceViewport` | Dynamic height fallback, viewport shape |
| `hooks/useWordFit` | One shared font size across all ten words |
| `lib/` | Content, locale, storage, media config, clock, segmentation |

### Frame-driven timing

The word passage and the final transformation are computed from a monotonic
`SceneClock` inside `useAnimationFrame`, writing to motion values rather than
React state, so the passage does not re-render sixty times a second. The clock
has reference-counted freeze reasons, which is what makes hidden-tab freezing
and exact hold cancellation possible.

The **scroll reveal uses no clock at all** — it is a pure function of scroll
position, so waiting changes nothing and scrolling back reverses it.

## Wiring up the real footage

Edit `components/entrance/lib/mediaConfig.ts`:

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
