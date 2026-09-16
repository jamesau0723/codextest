# Production media

The performance recording **has been supplied and is wired up**. These files are
generated from the client's 3840×2160 HEVC master (21.1 s) by
`tools/make-media.mjs`; the original is not in the repository.

| File | Size | Use |
|---|---|---|
| `performance-master.mp4` | 4.2 MB | 1920×1080 H.264, desktop |
| `performance-master.webm` | 1.4 MB | VP9 alternative |
| `performance-compact.mp4` | 1.4 MB | 1280×720 H.264, viewports ≤ 900 CSS px |
| `performance-compact.webm` | 0.7 MB | VP9 alternative |
| `performance-poster.jpg` | 134 KB | 1920×1080 frame from t = 9 s |

Audio is stripped from every encode: the entrance is muted by design.

H.264 is listed first in `mediaConfig.ts` because it decodes in hardware almost
everywhere, which matters for battery behind a looping background, and is the
only format older iOS Safari accepts. VP9 covers Chromium builds compiled
without proprietary codecs.

## One decision still open

The encodes are **trimmed to 18.0 s**, stopping just before a cross-dissolve at
t ≈ 18.15 s into a 2.3 s close-up of the pianist. The close-up cannot survive a
full-viewport crop: a phone in portrait shows only 26% of the source width, and
the face sits right of centre, so the alignment the wide shot needs leaves
almost nothing but empty wall.

See `docs/HANDOFF.md` §1.1 for the alternatives. Re-run `npm run media` with a
different trim to change it.

## Still to confirm

- publication permission for the performers shown
- whether the 18 s trim is approved
- whether a re-framed close-up should be supplied as a second shot
