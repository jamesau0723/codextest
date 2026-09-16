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

## The trim — approved 2026-09-16

The encodes are **trimmed to 18.0 s**, stopping just before a cross-dissolve at
t ≈ 18.15 s into a 2.3 s close-up of the pianist. The close-up could not survive
a full-viewport crop: a phone in portrait shows only 26% of the source width,
and the face sits right of centre, so the alignment the wide shot needs left
almost nothing but empty wall.

The client approved the trim. To change it, re-run `npm run media` with a
different `TRIM_SECONDS`.

## Still to confirm

- publication permission for the performers shown
- whether to cross-dissolve the loop point: the trimmed loop restarts with a
  visible jump, since the camera is locked off but the performers have moved.
  This was **not** part of the trim approval and has not been done.
