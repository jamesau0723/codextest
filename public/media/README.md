# Production media

The performance recording **has been supplied and is wired up**. These files are
generated from the client's 3840×2160 HEVC master (21.1 s) by
`tools/make-media.mjs`; the original is not in the repository.

| File | Size | Use |
|---|---|---|
| `performance-master.mp4` | 4.3 MB | 1920×1080 H.264, desktop |
| `performance-master.webm` | 1.7 MB | VP9 alternative |
| `performance-compact.mp4` | 1.3 MB | 1280×720 H.264, viewports ≤ 900 CSS px |
| `performance-compact.webm` | 0.8 MB | VP9 alternative |
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

## The loop seam

The encodes blend the trim's tail into its head over 0.6 s, so the output's
first and last frames are the same image and the loop is continuous. Output
length is therefore 17.4 s, not 18.0 s.

PSNR between the final and first frames is 36.6 dB, against 35.9 dB for two
ordinary consecutive frames mid-loop: the seam differs less than normal motion
does. Set `CROSSFADE_SECONDS` to 0 in the tool for a hard cut instead.

## Still to confirm

- publication permission for the performers shown
